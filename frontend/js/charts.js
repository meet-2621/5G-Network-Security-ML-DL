
const Charts = (() => {

    // ==========================================
    // COMMON COLORS AND CHART DEFAULTS
    // ==========================================

    const colors = {
        cyan: '#06b6d4',
        purple: '#8b5cf6',
        green: '#10b981',
        red: '#ef4444',
        orange: '#f59e0b',
        blue: '#3b82f6',
        pink: '#ec4899',
        text: '#94a3b8',
        grid: 'rgba(148, 163, 184, 0.12)'
    };

    if (typeof Chart === 'undefined') {
        console.error('[Charts] Chart.js is not loaded.');
        return {};
    }

    Chart.defaults.color = colors.text;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 18;


    // ==========================================
    // 1. THREAT DISTRIBUTION DOUGHNUT CHART
    // ==========================================

    function initThreatChart(canvasId) {

        const canvas = document.getElementById(canvasId);

        if (!canvas) {
            console.error(`[Charts] Canvas not found: ${canvasId}`);
            return null;
        }

        const chart = new Chart(canvas, {
            type: 'doughnut',

            data: {
                labels: [
                    'Normal',
                    'DDoS',
                    'Port Scan',
                    'DNS Spoof',
                    'MITM'
                ],

                datasets: [{
                    data: [0, 0, 0, 0, 0],

                    backgroundColor: [
                        colors.green,
                        colors.red,
                        colors.orange,
                        colors.purple,
                        colors.pink
                    ],

                    borderColor: '#111827',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',

                plugins: {
                    legend: {
                        position: 'bottom',

                        labels: {
                            color: colors.text
                        }
                    },

                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.label}: ${Number(context.raw || 0).toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        });

        return chart;
    }


    // ==========================================
    // 2. TRAFFIC TIMELINE LINE CHART
    // ==========================================

    function initTimelineChart(canvasId) {

        const canvas = document.getElementById(canvasId);

        if (!canvas) {
            console.error(`[Charts] Canvas not found: ${canvasId}`);
            return null;
        }

        return new Chart(canvas, {

            type: 'line',

            data: {
                labels: [],

                datasets: [

                    {
                        label: 'Normal Traffic',
                        data: [],

                        borderColor: colors.green,
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',

                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        borderWidth: 2
                    },

                    {
                        label: 'Malicious Traffic',
                        data: [],

                        borderColor: colors.red,
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',

                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        borderWidth: 2
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: 'index'
                },

                plugins: {
                    legend: {
                        position: 'top'
                    }
                },

                scales: {

                    x: {
                        grid: {
                            color: colors.grid
                        },

                        ticks: {
                            maxTicksLimit: 8
                        }
                    },

                    y: {
                        beginAtZero: true,

                        grid: {
                            color: colors.grid
                        },

                        title: {
                            display: true,
                            text: 'Packets'
                        }
                    }
                }
            }
        });
    }


    // ==========================================
    // 3. ML MODEL PERFORMANCE COMPARISON
    // ==========================================

    function initModelChart(canvasId) {

        const canvas = document.getElementById(canvasId);

        if (!canvas) {
            console.error(`[Charts] Canvas not found: ${canvasId}`);
            return null;
        }

        return new Chart(canvas, {

            type: 'bar',

            data: {

                labels: [
                    'Random Forest',
                    'XGBoost',
                    'SVM',
                    'Deep Learning'
                ],

                datasets: [

                    {
                        label: 'Accuracy',

                        data: [
                            99.45,
                            99.40,
                            98.65,
                            98.85
                        ],

                        backgroundColor: colors.cyan,
                        borderRadius: 5
                    },

                    {
                        label: 'Precision',

                        data: [
                            99.45,
                            99.40,
                            98.63,
                            98.90
                        ],

                        backgroundColor: colors.purple,
                        borderRadius: 5
                    },

                    {
                        label: 'Recall',

                        data: [
                            99.45,
                            99.40,
                            98.65,
                            98.85
                        ],

                        backgroundColor: colors.green,
                        borderRadius: 5
                    },

                    {
                        label: 'F1 Score',

                        data: [
                            99.44,
                            99.40,
                            98.63,
                            98.87
                        ],

                        backgroundColor: colors.orange,
                        borderRadius: 5
                    }
                ]
            },

            options: {

                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    mode: 'index',
                    intersect: false
                },

                plugins: {

                    legend: {
                        position: 'bottom'
                    },

                    tooltip: {
                        callbacks: {
                            label: function (context) {

                                const value = Number(context.raw || 0);

                                return `${context.dataset.label}: ${value.toFixed(2)}%`;
                            }
                        }
                    }
                },

                scales: {

                    x: {
                        min: 95,
                        max: 100,

                        title: {
                            display: true,
                            text: 'Performance (%)'
                        },

                        grid: {
                            color: colors.grid
                        },

                        ticks: {
                            callback: value => `${value}%`
                        }
                    },

                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }


    // ==========================================
    // HELPER: NORMALIZE THREAT COUNTERS
    // ==========================================

    function normalizeThreatData(threatData) {

        if (!threatData || typeof threatData !== 'object') {
            return [0, 0, 0, 0, 0];
        }

        // Supports both direct counters and nested counters.
        const data = threatData.counters || threatData;

        return [
            Number(data.normal ?? 0),
            Number(data.ddos ?? 0),
            Number(data.port_scan ?? 0),
            Number(data.dns_spoof ?? 0),
            Number(data.mitm ?? 0)
        ].map(value =>
            Number.isFinite(value) && value >= 0 ? value : 0
        );
    }


    // ==========================================
    // 4. UPDATE THREAT DISTRIBUTION CHART
    // ==========================================

    function updateThreatChart(chart, threatData) {

        if (!chart) {
            console.error('[Charts] Threat chart is not initialized.');
            return;
        }

        if (!threatData) {
            console.warn('[Charts] No threat data received.');
            return;
        }

        const values = normalizeThreatData(threatData);

        // Update doughnut chart values.
        chart.data.datasets[0].data = values;

        // Calculate total traffic.
        const total = values.reduce(
            (sum, value) => sum + value,
            0
        );

        // Update centre number.
        const totalElement = document.getElementById('threat-total');

        if (totalElement) {
            totalElement.textContent = total.toLocaleString();
        }

        // Update chart.
        chart.update('none');

        console.log('[Charts] Threat distribution updated:', {
            normal: values[0],
            ddos: values[1],
            port_scan: values[2],
            dns_spoof: values[3],
            mitm: values[4],
            total: total
        });
    }


    // ==========================================
    // 5. UPDATE TRAFFIC TIMELINE CHART
    // ==========================================

    function updateTimelineChart(chart, timelineData) {

        if (!chart) return;

        if (!Array.isArray(timelineData)) {
            console.warn('[Charts] Invalid timeline data.');
            return;
        }

        chart.data.labels = timelineData.map(item => {

            if (item.timestamp) {
                return new Date(item.timestamp).toLocaleTimeString();
            }

            return item.time || '';
        });

        chart.data.datasets[0].data = timelineData.map(item =>
            Number(item.normal_count || 0)
        );

        chart.data.datasets[1].data = timelineData.map(item =>
            Number(item.attack_count || 0)
        );

        chart.update('none');
    }


    // ==========================================
    // EXPORT FUNCTIONS
    // ==========================================

    return {

        initThreatChart,
        initTimelineChart,
        initModelChart,

        updateThreatChart,
        updateTimelineChart

    };

})();
