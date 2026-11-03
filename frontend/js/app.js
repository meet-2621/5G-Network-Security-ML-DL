
document.addEventListener('DOMContentLoaded', async () => {
    // ==========================================
    // 1. DASHBOARD STATE
    // ==========================================

    const state = {
        packets: 0,
        threats: 0,
        uptime: 0,
        counters: {
            normal: 0,
            ddos: 0,
            port_scan: 0,
            dns_spoof: 0,
            mitm: 0
        },
        connected: false,
        blockedIPs: new Map(),
        timeline: {
            labels: [],
            normal: [],
            attacks: []
        }
    };

    // ==========================================
    // 2. INITIALIZE CHARTS
    // ==========================================

    const threatChart = Charts.initThreatChart('threatDoughnutChart');
    const timelineChart = Charts.initTimelineChart('timelineChart');
    const modelChart = Charts.initModelChart('modelBarChart');

    // ==========================================
    // 3. CLOCK AND UPTIME
    // ==========================================

    updateClock();
    setInterval(updateClock, 1000);

    setInterval(() => {
        state.uptime++;
        setText('stat-uptime', formatUptime(state.uptime));
    }, 1000);

    // ==========================================
    // 4. LOAD INITIAL DASHBOARD DATA
    // ==========================================

    try {
        const [statsData, trafficData, networkData] = await Promise.all([
            API.getStats(),
            API.getTraffic(20),
            API.getNetwork()
        ]);

        if (statsData.counters) {
            updateCounters(statsData.counters);
            updateStatsDisplay();
            Charts.updateThreatChart(threatChart, state.counters);
        }

        if (statsData.modelMetrics) {
            updateModelMetrics(statsData.modelMetrics, modelChart);
        }

        // Load previous traffic events
        if (trafficData.data && Array.isArray(trafficData.data)) {
            const tbody = document.getElementById('traffic-feed-body');

            if (tbody) {
                tbody.innerHTML = '';

                trafficData.data.forEach(event => {
                    tbody.appendChild(createTrafficRow(event));
                });
            }
        }

        // Update network topology nodes
        if (networkData.components && Array.isArray(networkData.components)) {
            networkData.components.forEach(comp => {
                const node = document.getElementById(`node-${comp.id}`);

                if (node) {
                    node.className =
                        `node ${comp.status === 'active' ? 'active' : comp.status}`;
                }
            });
        }

    } catch (err) {
        console.error('[App] Failed to load initial data:', err);
    }

    // Load firewall state on startup
    await refreshFirewall();

    // Manual block button
    const blockButton = document.getElementById('fw-block-btn');
    if (blockButton) {
        blockButton.addEventListener('click', async () => {
            const input = document.getElementById('fw-ip-input');
            const ip = input ? input.value.trim() : '';

            if (!ip) {
                showToast('Enter an IPv4 address first.', 'error');
                return;
            }

            blockButton.disabled = true;
            try {
                const result = await API.blockIP(ip, 'manual');
                if (!result.success) {
                    throw new Error(result.error || 'Unable to block IP');
                }
                if (input) input.value = '';
                await refreshFirewall();
                showToast(`Block recorded for ${ip}.`, 'success');
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                blockButton.disabled = false;
            }
        });
    }

    // ==========================================
    // 5. SOCKET.IO CONNECTION
    // ==========================================

    const socket = io();

    socket.on('connect', () => {
        state.connected = true;

        console.log('[Socket] Connected:', socket.id);

        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        state.connected = false;

        console.log('[Socket] Disconnected');

        updateConnectionStatus(false);
    });

    socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);

        updateConnectionStatus(false);
    });

    socket.on('reconnect', () => {
        console.log('[Socket] Reconnected — refreshing dashboard');
        refreshStats();
        refreshFirewall();
    });

    // Firewall events emitted by backend
    socket.on('ip-blocked', (entry) => {
        if (!entry || !entry.ip) return;
        state.blockedIPs.set(entry.ip, entry);
        renderFirewallTable();
        updateTrafficActionCells();
        showToast(`${entry.ip} added to firewall blocklist.`, 'success');
    });

    socket.on('ip-unblocked', (event) => {
        if (!event || !event.ip) return;
        state.blockedIPs.delete(event.ip);
        renderFirewallTable();
        updateTrafficActionCells();
        showToast(`${event.ip} removed from firewall blocklist.`, 'success');
    });

    socket.on('firewall-update', () => refreshFirewall());

    // Keep firewall state synchronized even if a socket event was missed.
    setInterval(refreshFirewall, 5000);

    // ==========================================
    // 6. LIVE TRAFFIC EVENT
    // ==========================================

    socket.on('traffic-event', (event) => {
        if (!event) return;

        state.packets++;

        const prediction = (event.prediction || 'normal').toLowerCase();
        const isAttack = prediction !== 'normal';

        if (state.counters[prediction] !== undefined) {
            state.counters[prediction]++;
        }

        if (isAttack) {
            state.threats++;
            flashNetworkNodes('attack');
        } else {
            flashNetworkNodes('active');
        }

        updateStatsDisplay();

        Charts.updateThreatChart(threatChart, state.counters);

        // Update live traffic timeline
        const now = event.timestamp
            ? new Date(event.timestamp)
            : new Date();

        const timeLabel = formatTime(now);

        const packetRate = event.features
            ? Number(event.features.packet_rate || 0)
            : 0;

        updateLiveTimeline(
            timeLabel,
            isAttack ? 0 : packetRate,
            isAttack ? packetRate : 0
        );

        addTrafficRow(event);
    });

    // ==========================================
    // 7. LIVE STATISTICS UPDATE
    // ==========================================

    socket.on('stats-update', (stats) => {
        if (!stats || !stats.counters) return;

        updateCounters(stats.counters);
        updateStatsDisplay();

        Charts.updateThreatChart(threatChart, state.counters);
    });

    // ==========================================
    // 8. FALLBACK POLLING
    // ==========================================

    setInterval(async () => {
        if (!state.connected) {
            await refreshStats();
        }
    }, 5000);

    // ==========================================
    // 9. UPDATE COUNTERS
    // ==========================================

    function updateCounters(counters) {
        state.counters = {
            normal: Number(counters.normal || 0),
            ddos: Number(counters.ddos || 0),
            port_scan: Number(counters.port_scan || 0),
            dns_spoof: Number(counters.dns_spoof || 0),
            mitm: Number(counters.mitm || 0)
        };

        state.packets = Number(
            counters.total ??
            Object.values(state.counters).reduce((sum, value) => sum + value, 0)
        );

        state.threats =
            state.counters.ddos +
            state.counters.port_scan +
            state.counters.dns_spoof +
            state.counters.mitm;
    }

    // ==========================================
    // 10. UPDATE STATISTICS DISPLAY
    // ==========================================

    function updateStatsDisplay() {
        setText('stat-packets', state.packets.toLocaleString());
        setText('stat-threats', state.threats.toLocaleString());
        setText('stat-uptime', formatUptime(state.uptime));
    }

    // ==========================================
    // 11. REFRESH STATS FROM BACKEND
    // ==========================================

    async function refreshStats() {
        try {
            const statsData = await API.getStats();

            if (statsData.counters) {
                updateCounters(statsData.counters);
                updateStatsDisplay();

                Charts.updateThreatChart(threatChart, state.counters);
            }

            if (statsData.modelMetrics) {
                updateModelMetrics(statsData.modelMetrics, modelChart);
            }

            if (typeof statsData.uptime === 'number') {
                state.uptime = statsData.uptime;
                setText('stat-uptime', formatUptime(state.uptime));
            }

        } catch (err) {
            console.error('[App] Stats refresh failed:', err);
        }
    }

    // ==========================================
    // 12. CREATE TRAFFIC TABLE ROW
    // ==========================================

    function createTrafficRow(event) {
        const tr = document.createElement('tr');
        const prediction = (event.prediction || 'normal').toLowerCase();
        const isAttack = prediction !== 'normal';
        const date = event.timestamp ? new Date(event.timestamp) : new Date();
        const labelMap = {
            normal: 'Normal',
            ddos: 'DDoS',
            port_scan: 'Port Scan',
            dns_spoof: 'DNS Spoof',
            mitm: 'MITM'
        };

        const sourceIp = event.source_ip || event.src_ip || '—';
        const blockedEntry = state.blockedIPs.get(sourceIp);
        const isBlocked = !!(event.blocked || blockedEntry);
        tr.dataset.sourceIp = sourceIp;
        tr.className = isAttack ? 'row-attack slide-in' : 'row-normal slide-in';

        const confidence = event.confidence != null
            ? `${(Number(event.confidence) * 100).toFixed(1)}%`
            : '—';

        const packetSize = event.features
            ? (event.features.packet_size ?? '—')
            : '—';

        const protocol = event.features
            ? API.protocolName(event.features.protocol_type)
            : 'TCP';

        const values = [
            formatTimeMs(date),
            sourceIp,
            protocol,
            `${packetSize} B`,
            labelMap[prediction] || prediction,
            confidence
        ];

        values.forEach((value, index) => {
            const td = document.createElement('td');
            if (index === 4) {
                const tag = document.createElement('span');
                tag.className = `tag ${isAttack ? 'tag-attack' : 'tag-normal'}`;
                tag.textContent = value;
                td.appendChild(tag);
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        const actionCell = document.createElement('td');
        const actionTag = document.createElement('span');
        actionTag.className = `tag ${isBlocked ? 'tag-blocked' : (isAttack ? 'tag-pending' : 'tag-normal')}`;
        actionTag.textContent = isBlocked
            ? (blockedEntry && blockedEntry.enforced ? 'BLOCKED' : 'BLOCKED · SIMULATED')
            : (isAttack ? 'DETECTED' : 'ALLOWED');
        actionCell.appendChild(actionTag);
        tr.appendChild(actionCell);

        return tr;
    }

    function updateTrafficActionCells() {
        document.querySelectorAll('#traffic-feed-body tr[data-source-ip]').forEach(row => {
            const ip = row.dataset.sourceIp;
            const entry = state.blockedIPs.get(ip);
            const cell = row.lastElementChild;
            if (!cell) return;
            const tag = cell.querySelector('.tag');
            if (!tag) return;

            if (entry) {
                tag.className = 'tag tag-blocked';
                tag.textContent = entry.enforced ? 'BLOCKED' : 'BLOCKED · SIMULATED';
            } else if (row.classList.contains('row-attack')) {
                tag.className = 'tag tag-pending';
                tag.textContent = 'DETECTED';
            } else {
                tag.className = 'tag tag-normal';
                tag.textContent = 'ALLOWED';
            }
        });
    }

    // ==========================================
    // 13. ADD LIVE TRAFFIC ROW
    // ==========================================

    function addTrafficRow(event) {
        const tbody = document.getElementById('traffic-feed-body');

        if (!tbody) return;

        const row = createTrafficRow(event);

        tbody.insertBefore(row, tbody.firstChild);

        setTimeout(() => {
            row.classList.remove('slide-in');
        }, 500);

        // Keep only the latest 50 events
        while (tbody.children.length > 50) {
            tbody.removeChild(tbody.lastChild);
        }
    }

    // ==========================================
    // 14. UPDATE LIVE TIMELINE
    // ==========================================

    function updateLiveTimeline(timeLabel, normalValue, attackValue) {
        if (!timelineChart) return;

        const maxPoints = 30;

        state.timeline.labels.push(timeLabel);
        state.timeline.normal.push(normalValue);
        state.timeline.attacks.push(attackValue);

        if (state.timeline.labels.length > maxPoints) {
            state.timeline.labels.shift();
            state.timeline.normal.shift();
            state.timeline.attacks.shift();
        }

        // This matches the updated charts.js function signature.
        Charts.updateTimelineChart(timelineChart, state.timeline.labels.map(
            (label, index) => ({
                time: label,
                normal_count: state.timeline.normal[index],
                attack_count: state.timeline.attacks[index]
            })
        ));
    }

    // ==========================================
    // 15. NETWORK NODE ANIMATION
    // ==========================================

    function flashNetworkNodes(type) {
        const lines = document.querySelectorAll('.conn-line');

        lines.forEach(line => {
            line.classList.remove('active-traffic', 'attack-traffic');

            // Restart CSS animation
            void line.offsetWidth;

            line.classList.add(
                type === 'attack'
                    ? 'attack-traffic'
                    : 'active-traffic'
            );
        });

        if (type === 'attack') {
            const mlNode = document.getElementById('node-ml');

            if (mlNode) {
                mlNode.classList.add('attack');

                setTimeout(() => {
                    mlNode.classList.remove('attack');
                }, 1000);
            }
        }
    }

    // ==========================================
    // 16. CONNECTION STATUS
    // ==========================================

    function updateConnectionStatus(connected) {
        const dot = document.getElementById('sys-status-dot');
        const text = document.getElementById('sys-status-text');

        if (dot) {
            dot.className = connected
                ? 'status-indicator active'
                : 'status-indicator offline';
        }

        if (text) {
            text.innerText = connected
                ? 'System Active'
                : 'Disconnected';
        }
    }

    // ==========================================
    // FIREWALL DASHBOARD
    // ==========================================

    async function refreshFirewall() {
        try {
            const response = await API.getFirewall();
            if (!response || !response.success) return;

            const entries = Array.isArray(response.blocked)
                ? response.blocked
                : (response.status && Array.isArray(response.status.blockedIPs)
                    ? response.status.blockedIPs
                    : []);

            state.blockedIPs.clear();
            entries.forEach(entry => {
                if (entry && entry.ip) state.blockedIPs.set(entry.ip, entry);
            });

            const status = response.status || {};
            setText(
                'fw-mode-badge',
                status.dryRun ? 'DRY RUN · SIMULATED' : 'LIVE FIREWALL'
            );
            setText('fw-count-badge', `${state.blockedIPs.size} blocked`);

            renderFirewallTable();
            updateTrafficActionCells();
        } catch (error) {
            console.error('[Firewall] Refresh failed:', error);
        }
    }

    function renderFirewallTable() {
        const tbody = document.getElementById('fw-body');
        if (!tbody) return;

        const entries = [...state.blockedIPs.values()].sort(
            (a, b) => new Date(b.blockedAt || 0) - new Date(a.blockedAt || 0)
        );

        setText('fw-count-badge', `${entries.length} blocked`);

        if (!entries.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="fw-empty">No IPs blocked yet</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        entries.forEach(entry => {
            const tr = document.createElement('tr');
            const date = entry.blockedAt ? new Date(entry.blockedAt) : null;
            const statusText = entry.enforced ? 'ENFORCED' : 'SIMULATED';
            const values = [
                entry.ip,
                entry.attackType || '—',
                date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—',
                entry.source || '—'
            ];

            values.forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });

            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = `tag ${entry.enforced ? 'tag-blocked' : 'tag-pending'}`;
            statusBadge.textContent = statusText;
            statusCell.appendChild(statusBadge);
            tr.appendChild(statusCell);

            const actionCell = document.createElement('td');
            const button = document.createElement('button');
            button.className = 'fw-btn fw-btn-secondary';
            button.textContent = 'Unblock';
            button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    const result = await API.unblockIP(entry.ip);
                    if (!result.success) {
                        throw new Error(result.error || 'Unable to unblock IP');
                    }
                    await refreshFirewall();
                    showToast(`${entry.ip} removed from blocklist.`, 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                    button.disabled = false;
                }
            });
            actionCell.appendChild(button);
            tr.appendChild(actionCell);
            tbody.appendChild(tr);
        });
    }

    function showToast(message, type = 'info') {
        const area = document.getElementById('toast-area');
        if (!area) {
            console.log(`[${type}] ${message}`);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        area.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // ==========================================
    // 17. MODEL PERFORMANCE AND EVALUATION
    // ==========================================

    function updateModelMetrics(metrics, chart) {
        if (!metrics || typeof metrics !== 'object') return;

        // Keep only valid model metric objects
        const modelNames = Object.keys(metrics).filter(name => {
            const model = metrics[name];

            return (
                model &&
                typeof model === 'object' &&
                typeof model.accuracy === 'number'
            );
        });

        if (modelNames.length === 0) {
            console.warn('[Models] No valid model metrics received.');
            return;
        }

        // Rank models by F1 score
        modelNames.sort((a, b) => {
            return (
                (metrics[b].f1_score || 0) -
                (metrics[a].f1_score || 0)
            );
        });

        const accuracy = modelNames.map(name =>
            metrics[name].accuracy * 100
        );

        const precision = modelNames.map(name =>
            (metrics[name].precision ?? 0) * 100
        );

        const recall = modelNames.map(name =>
            (metrics[name].recall ?? 0) * 100
        );

        const f1 = modelNames.map(name =>
            (metrics[name].f1_score ?? metrics[name].f1 ?? 0) * 100
        );

        // Update model comparison chart
        if (chart && chart.data.datasets.length >= 4) {
            chart.data.labels = modelNames;

            chart.data.datasets[0].data = accuracy;
            chart.data.datasets[1].data = precision;
            chart.data.datasets[2].data = recall;
            chart.data.datasets[3].data = f1;

            const allValues = [
                ...accuracy,
                ...precision,
                ...recall,
                ...f1
            ];

            const minVal = Math.min(...allValues);

            chart.options.scales.x.min = Math.max(
                0,
                Math.floor(minVal - 2)
            );

            chart.options.scales.x.max = 100;

            chart.update();
        }

        // Best model is the first after F1 ranking
        const bestModel = modelNames[0];
        const bestAccuracy = metrics[bestModel].accuracy * 100;

        setText('best-model-badge', `Best Model: ${bestModel}`);
        setText('stat-accuracy', `${bestAccuracy.toFixed(2)}%`);

        const circle = document.querySelector('.circle');

        if (circle) {
            circle.setAttribute(
                'stroke-dasharray',
                `${bestAccuracy}, 100`
            );
        }

        // Update detailed evaluation table
        const tbody = document.getElementById('model-metrics-body');

        if (!tbody) return;

        tbody.innerHTML = '';

        modelNames.forEach((name, index) => {
            const model = metrics[name];
            const tr = document.createElement('tr');

            if (index === 0) {
                tr.classList.add('best-model-row');
            }

            const values = [
                name,
                formatPercent(model.accuracy),
                formatPercent(model.precision),
                formatPercent(model.recall),
                formatPercent(model.f1_score ?? model.f1),
                formatPercent(model.macro_f1)
            ];

            values.forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });

            const rankCell = document.createElement('td');

            if (index === 0) {
                const badge = document.createElement('span');
                badge.className = 'tag tag-normal';
                badge.textContent = 'Best';
                rankCell.appendChild(badge);
            } else {
                rankCell.textContent = `#${index + 1}`;
            }

            tr.appendChild(rankCell);
            tbody.appendChild(tr);
        });

        console.log('[Models] Evaluation table updated:', modelNames);
    }

    // ==========================================
    // 18. FORMAT MODEL METRIC PERCENTAGES
    // ==========================================

    function formatPercent(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '—';
        }

        return `${(value * 100).toFixed(2)}%`;
    }

    // ==========================================
    // 19. CLOCK
    // ==========================================

    function updateClock() {
        const clock = document.getElementById('clock');

        if (!clock) return;

        clock.innerText = new Date().toLocaleTimeString('en-US', {
            hour12: false
        });
    }

    // ==========================================
    // 20. UPTIME FORMAT
    // ==========================================

    function formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (d > 0) {
            return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
        }

        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    // ==========================================
    // 21. TIME FORMATTING
    // ==========================================

    function formatTime(date) {
        return [
            pad(date.getHours()),
            pad(date.getMinutes()),
            pad(date.getSeconds())
        ].join(':');
    }

    function formatTimeMs(date) {
        return `${formatTime(date)}.${String(
            date.getMilliseconds()
        ).padStart(3, '0')}`;
    }

    // ==========================================
    // 22. COMMON HELPERS
    // ==========================================

    function pad(number) {
        return String(number).padStart(2, '0');
    }

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.innerText = value;
        }
    }

});
