// ==UserScript==
// @name         DeepSeek Platform API Key 消费汇总
// @name:zh-CN   DeepSeek 平台 API Key 消费汇总
// @namespace    https://github.com/In-clude/deepseek-api-usage-stats
// @version      8.3
// @description  在 DeepSeek 开放平台按 API Key 汇总消费金额，可选最近 1/3/6/12 个月，支持面板折叠
// @author       In-clude
// @license      MIT
// @match        https://platform.deepseek.com/*
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/In-clude/deepseek-api-usage-stats
// @supportURL   https://github.com/In-clude/deepseek-api-usage-stats/issues
// @downloadURL  https://raw.githubusercontent.com/In-clude/deepseek-api-usage-stats/main/deepseek-api-usage-stats.user.js
// @updateURL    https://raw.githubusercontent.com/In-clude/deepseek-api-usage-stats/main/deepseek-api-usage-stats.user.js
// ==/UserScript==

(function () {
    'use strict';

    const SECTION_DAYS = 30;
    const DAY_SECONDS = 86400;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function getPlatformToken() {
        try {
            const raw = localStorage.getItem('userToken');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.value || parsed;
        } catch (e) {
            return null;
        }
    }

    async function fetchCostData(start, end, token) {
        const alignedStart = Math.floor(start / DAY_SECONDS) * DAY_SECONDS;
        const alignedEnd = Math.ceil(end / DAY_SECONDS) * DAY_SECONDS;
        const tz = new Date().getTimezoneOffset() * 60;

        const url =
            `https://platform.deepseek.com/api/v0/usage/by_api_key/cost` +
            `?start=${alignedStart}&end=${alignedEnd}&tz=${tz}&bucket=${DAY_SECONDS}`;

        const res = await fetch(url, {
            headers: {
                Authorization: 'Bearer ' + token,
                Accept: 'application/json',
                'x-client-platform': 'web',
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json?.data?.biz_code !== 0) {
            throw new Error('业务报错: ' + json?.data?.biz_msg);
        }

        return json?.data?.biz_data?.data?.[0]?.series || [];
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'ds-final-counter';
        panel.style.cssText = `
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 99999;
            width: 400px;
            overflow: hidden;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            color: #333;
            font-family: -apple-system, sans-serif;
            font-size: 13px;
            transition: all 0.2s ease;
        `;

        panel.innerHTML = `
            <div style="padding: 12px 16px; background: #f7f7f8; border-bottom: 1px solid #eee; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                <span>消费汇总</span>
                <div>
                    <span id="ds-toggle" style="cursor:pointer;color:#666;font-weight:400;font-size:14px;margin-right:12px;user-select:none;" title="折叠/展开">▼</span>
                    <span id="ds-close" style="cursor:pointer;color:#999;font-weight:400;font-size:16px;" title="关闭">✕</span>
                </div>
            </div>
            <div id="ds-panel-body" style="padding: 14px 16px; max-height: 500px; overflow-y: auto;">

                <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; background:#f7f7f8; padding:8px 10px; border-radius:6px;">
                    <span style="font-size:13px; color:#555;">统计范围：</span>
                    <select id="ds-month-select" style="padding:6px 28px 6px 12px; border:1px solid #ddd; border-radius:6px; font-size:13px; outline:none; background:#fff; cursor:pointer;">
                        <option value="1">最近 1 个月</option>
                        <option value="3">最近 3 个月</option>
                        <option value="6">最近 6 个月</option>
                        <option value="12" selected>最近 12 个月</option>
                    </select>
                </div>

                <button id="ds-run-all" style="width:100%;padding:10px;background:#1a7f37;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:12px;">
                    开始一键统计
                </button>
                <div id="ds-status" style="margin-bottom:12px;font-size:12px;color:#d32f2f;line-height:1.6;min-height:20px;"></div>
                <div id="ds-results" style="display:none;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#f7f7f8;border-bottom:1px solid #eee;">
                                <th style="padding:8px 4px;text-align:left;font-weight:600;">API Key 名称</th>
                                <th style="padding:8px 4px;text-align:right;font-weight:600;">消费金额 (¥)</th>
                            </tr>
                        </thead>
                        <tbody id="ds-tbody"></tbody>
                    </table>
                    <div id="ds-total" style="margin-top:10px;padding:10px;background:#f6f8fa;border-radius:6px;font-weight:600;display:flex;justify-content:space-between;">
                        <span>全部 Key 总计</span>
                        <span id="ds-total-val">—</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#ds-close').onclick = () => panel.remove();

        const toggleBtn = panel.querySelector('#ds-toggle');
        const bodyEl = panel.querySelector('#ds-panel-body');
        toggleBtn.onclick = () => {
            if (bodyEl.style.display === 'none') {
                bodyEl.style.display = 'block';
                toggleBtn.textContent = '▼';
                panel.style.width = '400px';
            } else {
                bodyEl.style.display = 'none';
                toggleBtn.textContent = '▲';
                panel.style.width = '130px';
            }
        };

        return panel;
    }

    async function runStatistics(statusEl, resultsEl, tbody, totalEl, runBtn, selectEl) {
        const token = getPlatformToken();
        if (!token) {
            statusEl.textContent = '未找到 userToken，请重新登录。';
            return;
        }

        const months = parseInt(selectEl.value, 10);
        selectEl.disabled = true;
        runBtn.disabled = true;
        runBtn.textContent = '正在拉取数据...';
        resultsEl.style.display = 'none';
        tbody.innerHTML = '';

        const segmentSec = SECTION_DAYS * DAY_SECONDS;
        const end = Math.ceil(Date.now() / 1000 / DAY_SECONDS) * DAY_SECONDS;
        const startLimit = end - months * segmentSec;
        const totalSegments = months;

        const aggregatedData = {};
        let currentSeg = 0;

        for (let currentStart = startLimit; currentStart < end; currentStart += segmentSec) {
            const currentEnd = Math.min(currentStart + segmentSec, end);
            currentSeg++;
            statusEl.textContent = `正在拉取第 ${currentSeg}/${totalSegments} 段数据...`;

            try {
                const costSeries = await fetchCostData(currentStart, currentEnd, token);
                await sleep(200);

                costSeries.forEach((item) => {
                    const keyName = item.api_key?.name || '未知 Key';
                    if (!aggregatedData[keyName]) aggregatedData[keyName] = 0;

                    (item.buckets || []).forEach((bucket) => {
                        const val = parseFloat(bucket.cost);
                        if (!isNaN(val)) aggregatedData[keyName] += val;
                    });
                });
            } catch (e) {
                console.warn(`拉取第 ${currentSeg} 段失败`, e);
            }
        }

        statusEl.textContent = `统计完成！已获取近 ${months} 个月的数据。`;
        resultsEl.style.display = 'block';

        let totalCost = 0;

        const sortedKeys = Object.keys(aggregatedData)
            .filter((key) => aggregatedData[key] > 0)
            .sort((a, b) => aggregatedData[b] - aggregatedData[a]);

        if (sortedKeys.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="2" style="text-align:center;padding:10px;color:#999;">该时间段内没有任何消费记录</td></tr>';
        }

        sortedKeys.forEach((keyName) => {
            const cost = aggregatedData[keyName];
            totalCost += cost;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f0f0f0';
            tr.innerHTML = `
                <td style="padding:10px 4px;word-break:break-all;color:#1a7f37;font-weight:500;">${escapeHtml(keyName)}</td>
                <td style="padding:10px 4px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${formatMoney(cost)}</td>
            `;
            tbody.appendChild(tr);
        });

        totalEl.innerHTML = `<b style="color:#d32f2f;font-size:15px;">¥${formatMoney(totalCost)}</b>`;

        selectEl.disabled = false;
        runBtn.disabled = false;
        runBtn.textContent = '重新统计';
    }

    function formatMoney(n) {
        return Number(n).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    }

    function escapeHtml(s) {
        return s.replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
    }

    async function main() {
        let tries = 0;
        while (!getPlatformToken() && tries < 20) {
            await sleep(500);
            tries++;
        }

        const panel = createPanel();
        const runBtn = panel.querySelector('#ds-run-all');
        const selectEl = panel.querySelector('#ds-month-select');

        runBtn.addEventListener('click', () => {
            runStatistics(
                panel.querySelector('#ds-status'),
                panel.querySelector('#ds-results'),
                panel.querySelector('#ds-tbody'),
                panel.querySelector('#ds-total-val'),
                runBtn,
                selectEl,
            );
        });
    }

    main();
})();
