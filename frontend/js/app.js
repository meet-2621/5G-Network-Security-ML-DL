document.addEventListener('DOMContentLoaded', async () => {
    const state = {
        packets: 0,
        threats: 0,
        uptime: 0,
        counters: { normal: 0, ddos: 0, port_scan: 0, dns_spoof: 0, mitm: 0 },
        connected: false
    };

    const threatChart = Charts.initThreatChart('threatDoughnutChart');
    const timelineChart = Charts.initTimelineChart('timelineChart');
    const modelChart = Charts.initModelChart('modelBarChart');

    updateClock();
    setInterval(updateClock, 1000);
    setInterval(() => {
        state.uptime++;
        document.getElementById('stat-uptime').innerText = formatUptime(state.uptime);
    }, 1000);

    try {
        const [statsData, trafficData, networkData] = await Promise.all([
            API.getStats(),
            API.getTraffic(20),
            API.getNetwork()
        ]);

        if (statsData.counters) {
            state.counters = statsData.counters;
            state.packets = statsData.counters.total || 0;
            state.threats = (statsData.counters.ddos || 0) +
                            (statsData.counters.port_scan || 0) +
                            (statsData.counters.dns_spoof || 0) +
                            (statsData.counters.mitm || 0);
            state.uptime = statsData.uptime || 0;

            document.getElementById('stat-packets').innerText = state.packets.toLocaleString();
            document.getElementById('stat-threats').innerText = state.threats.toLocaleString();
            document.getElementById('stat-uptime').innerText = formatUptime(state.uptime);

            Charts.updateThreatChart(threatChart, state.counters);
        }

        if (statsData.modelMetrics) {
            updateModelMetrics(statsData.modelMetrics, modelChart);
        }

        if (statsData.modelMetrics && statsData.modelMetrics.accuracy) {
            const acc = (statsData.modelMetrics.accuracy * 100).toFixed(1);
            document.getElementById('stat-accuracy').innerText = acc + '%';
            const circle = document.querySelector('.circle');
            if (circle) circle.setAttribute('stroke-dasharray', `${acc}, 100`);
        }

        if (trafficData.data && trafficData.data.length > 0) {
            const tbody = document.getElementById('traffic-feed-body');
            trafficData.data.forEach(event => {
                tbody.appendChild(createTrafficRow(event));
            });
        }

        if (networkData.components) {
            networkData.components.forEach(comp => {
                const node = document.getElementById(`node-${comp.id}`);
                if (node) {
                    node.className = `node ${comp.status === 'active' ? 'active' : comp.status}`;
                }
            });
        }

    } catch (err) {
        console.error('[App] Failed to load initial data:', err);
    }

    const socket = io('http://localhost:3000');

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
        console.log('[Socket] Reconnected — re-syncing stats');
        API.getStats().then(statsData => {
            if (statsData.counters) {
                state.counters = statsData.counters;
                state.packets = statsData.counters.total || 0;
                state.threats = (statsData.counters.ddos || 0) +
                                (statsData.counters.port_scan || 0) +
                                (statsData.counters.dns_spoof || 0) +
                                (statsData.counters.mitm || 0);
                document.getElementById('stat-packets').innerText = state.packets.toLocaleString();
                document.getElementById('stat-threats').innerText = state.threats.toLocaleString();
                Charts.updateThreatChart(threatChart, state.counters);
            }
        });
    });

    setInterval(async () => {
        if (!state.connected) {
            const statsData = await API.getStats();
            if (statsData.counters) {
                state.counters = statsData.counters;
                state.packets = statsData.counters.total || 0;
                state.threats = (statsData.counters.ddos || 0) +
                                (statsData.counters.port_scan || 0) +
                                (statsData.counters.dns_spoof || 0) +
                                (statsData.counters.mitm || 0);
                document.getElementById('stat-packets').innerText = state.packets.toLocaleString();
                document.getElementById('stat-threats').innerText = state.threats.toLocaleString();
                Charts.updateThreatChart(threatChart, state.counters);
            }
        }
    }, 5000);

    socket.on('traffic-event', (event) => {
        state.packets++;
        const pred = event.prediction.toLowerCase();
        if (state.counters[pred] !== undefined) {
            state.counters[pred]++;
        }

        const isAttack = pred !== 'normal';
        if (isAttack) {
            state.threats++;
            flashNetworkNodes('attack');
        } else {
            flashNetworkNodes('active');
        }

        document.getElementById('stat-packets').innerText = state.packets.toLocaleString();
        document.getElementById('stat-threats').innerText = state.threats.toLocaleString();

        Charts.updateThreatChart(threatChart, state.counters);

        const now = new Date(event.timestamp);
        const timeLabel = formatTime(now);
        const packetRate = event.features ? (event.features.packet_rate || 0) : 0;
        const normalVal = isAttack ? 0 : packetRate;
        const attackVal = isAttack ? packetRate : 0;
        Charts.updateTimelineChart(timelineChart, timeLabel, normalVal, attackVal);

        addTrafficRow(event);
    });

    socket.on('stats-update', (stats) => {
        if (stats.counters) {
            state.counters = stats.counters;
            state.packets = stats.counters.total || 0;
            state.threats = (stats.counters.ddos || 0) +
                            (stats.counters.port_scan || 0) +
                            (stats.counters.dns_spoof || 0) +
                            (stats.counters.mitm || 0);

            document.getElementById('stat-packets').innerText = state.packets.toLocaleString();
            document.getElementById('stat-threats').innerText = state.threats.toLocaleString();
            Charts.updateThreatChart(threatChart, state.counters);
        }
    });

    function createTrafficRow(event) {
        const tr = document.createElement('tr');
        const pred = (event.prediction || 'normal').toLowerCase();
        const isAttack = pred !== 'normal';

        tr.className = isAttack ? 'row-attack slide-in' : 'row-normal slide-in';

        const date = new Date(event.timestamp);
        const timeStr = formatTimeMs(date);

        const labelMap = {
            'normal': 'Normal',
            'ddos': 'DDoS',
            'port_scan': 'Port Scan',
            'dns_spoof': 'DNS Spoof',
            'mitm': 'MITM'
        };
        const label = labelMap[pred] || pred;
        const confidence = event.confidence ? (event.confidence * 100).toFixed(1) : '—';
        const packetSize = event.features ? (event.features.packet_size || '—') : '—';
        const protocol = event.features ? API.protocolName(event.features.protocol_type) : 'TCP';
        const sourceIp = API.generateIP();

        tr.innerHTML = `
            <td>${timeStr}</td>
            <td>${sourceIp}</td>
            <td>${protocol}</td>
            <td>${packetSize} B</td>
            <td><span class="tag ${isAttack ? 'tag-attack' : 'tag-normal'}">${label}</span></td>
            <td>${confidence}%</td>
        `;
        return tr;
    }

    function addTrafficRow(event) {
        const tbody = document.getElementById('traffic-feed-body');
        const row = createTrafficRow(event);
        tbody.insertBefore(row, tbody.firstChild);

        setTimeout(() => row.classList.remove('slide-in'), 500);

        while (tbody.children.length > 50) {
            tbody.removeChild(tbody.lastChild);
        }
    }

    function flashNetworkNodes(type) {
        const lines = document.querySelectorAll('.conn-line');

        lines.forEach(line => {
            line.classList.remove('active-traffic', 'attack-traffic');
            void line.offsetWidth;
            line.classList.add(type === 'attack' ? 'attack-traffic' : 'active-traffic');
        });

        if (type === 'attack') {
            const mlNode = document.getElementById('node-ml');
            if (mlNode) {
                mlNode.classList.add('attack');
                setTimeout(() => mlNode.classList.remove('attack'), 1000);
            }
        }
    }

    function updateConnectionStatus(connected) {
        const dot = document.getElementById('sys-status-dot');
        const text = document.getElementById('sys-status-text');
        if (connected) {
            dot.className = 'status-indicator active';
            text.innerText = 'System Active';
        } else {
            dot.className = 'status-indicator offline';
            text.innerText = 'Disconnected';
        }
    }

    function updateModelMetrics(metrics, chart) {
        if (metrics && typeof metrics === 'object') {
            const modelNames = Object.keys(metrics).filter(k =>
                k !== 'best_model' && k !== 'lastTrained' && typeof metrics[k] === 'object'
            );

            if (modelNames.length > 0) {
                const labels = modelNames.map(name =>
                    name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                );
                const accuracy = modelNames.map(n => (metrics[n].accuracy || 0) * 100);
                const precision = modelNames.map(n => (metrics[n].precision || 0) * 100);
                const f1 = modelNames.map(n => (metrics[n].f1_score || metrics[n].f1 || 0) * 100);

                chart.data.labels = labels;
                chart.data.datasets[0].data = accuracy;
                chart.data.datasets[1].data = precision;
                chart.data.datasets[2].data = f1;

                const allValues = [...accuracy, ...precision, ...f1];
                const minVal = Math.min(...allValues);
                chart.options.scales.x.min = Math.max(0, Math.floor(minVal - 5));
                chart.options.scales.x.max = 100;

                chart.update();

                const bestAccuracy = Math.max(...accuracy);
                document.getElementById('stat-accuracy').innerText = bestAccuracy.toFixed(1) + '%';
                const circle = document.querySelector('.circle');
                if (circle) circle.setAttribute('stroke-dasharray', `${bestAccuracy.toFixed(1)}, 100`);
            }
        }
    }

    function updateClock() {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('en-US', { hour12: false });
    }

    function formatUptime(seconds) {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);

        if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function formatTime(date) {
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function formatTimeMs(date) {
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }
});
