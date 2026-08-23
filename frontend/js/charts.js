Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

const colors = {
    cyan: '#00d4ff',
    purple: '#7c3aed',
    green: '#10b981',
    red: '#ef4444',
    orange: '#f59e0b',
    yellow: '#eab308'
};

const Charts = {
    initThreatChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Normal', 'DDoS', 'Port Scan', 'DNS Spoof', 'MITM'],
                datasets: [{
                    data: [85, 5, 4, 3, 3],
                    backgroundColor: [
                        colors.cyan,
                        colors.red,
                        colors.orange,
                        colors.yellow,
                        colors.purple
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    },

    initTimelineChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        const gradientCyan = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCyan.addColorStop(0, 'rgba(0, 212, 255, 0.5)');
        gradientCyan.addColorStop(1, 'rgba(0, 212, 255, 0.0)');

        const gradientRed = ctx.createLinearGradient(0, 0, 0, 400);
        gradientRed.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
        gradientRed.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 20}, (_, i) => ''),
                datasets: [
                    {
                        label: 'Normal Traffic',
                        data: Array(20).fill(0),
                        borderColor: colors.cyan,
                        backgroundColor: gradientCyan,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHitRadius: 10
                    },
                    {
                        label: 'Attack Traffic',
                        data: Array(20).fill(0),
                        borderColor: colors.red,
                        backgroundColor: gradientRed,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHitRadius: 10
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8 }
                    },
                    y: {
                        beginAtZero: true,
                        border: { dash: [4, 4] },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    }
                },
                animation: {
                    duration: 400,
                    easing: 'linear'
                }
            }
        });
    },

    initModelChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Random Forest', 'XGBoost', 'SVM'],
                datasets: [
                    {
                        label: 'Accuracy',
                        data: [99.8, 98.5, 94.2],
                        backgroundColor: colors.cyan,
                        borderRadius: 4
                    },
                    {
                        label: 'Precision',
                        data: [99.1, 97.8, 92.5],
                        backgroundColor: colors.purple,
                        borderRadius: 4
                    },
                    {
                        label: 'F1 Score',
                        data: [99.4, 98.1, 93.3],
                        backgroundColor: colors.green,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    }
                },
                scales: {
                    x: {
                        min: 90,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    },

    updateThreatChart(chart, counts) {
        chart.data.datasets[0].data = [
            counts.normal || 0,
            counts.ddos || 0,
            counts.port_scan || 0,
            counts.dns_spoof || 0,
            counts.mitm || 0
        ];
        chart.update();
        
        const totalThreats = (counts.ddos || 0) + (counts.port_scan || 0) + (counts.dns_spoof || 0) + (counts.mitm || 0);
        document.getElementById('threat-total').innerText = totalThreats.toLocaleString();
    },

    updateTimelineChart(chart, timeLabel, normalCount, attackCount) {
        const maxPoints = 30;
        const data = chart.data;
        
        data.labels.push(timeLabel);
        data.datasets[0].data.push(normalCount);
        data.datasets[1].data.push(attackCount);
        
        if (data.labels.length > maxPoints) {
            data.labels.shift();
            data.datasets[0].data.shift();
            data.datasets[1].data.shift();
        }
        
        chart.update('none');
    }
};
