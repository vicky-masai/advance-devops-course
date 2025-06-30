// Charts functionality for Enterprise E-commerce Dashboard
class ChartManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#2563eb',
            secondary: '#64748b',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };
    }

    // Initialize all charts
    initializeCharts() {
        this.initializeSalesChart();
        this.initializeRevenueChart();
        this.initializeCustomerChart();
    }

    // Sales trend chart using Canvas API
    initializeSalesChart() {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = [
            { label: 'Mon', value: 12000 },
            { label: 'Tue', value: 15000 },
            { label: 'Wed', value: 18000 },
            { label: 'Thu', value: 14000 },
            { label: 'Fri', value: 22000 },
            { label: 'Sat', value: 19000 },
            { label: 'Sun', value: 25000 }
        ];

        this.drawLineChart(ctx, canvas, data);
    }

    drawLineChart(ctx, canvas, data) {
        const padding = 40;
        const width = canvas.width - (padding * 2);
        const height = canvas.height - (padding * 2);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set canvas size
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        
        // Calculate scales
        const maxValue = Math.max(...data.map(d => d.value));
        const minValue = Math.min(...data.map(d => d.value));
        const valueRange = maxValue - minValue;
        
        const xStep = width / (data.length - 1);
        const yScale = height / valueRange;
        
        // Draw grid lines
        this.drawGrid(ctx, canvas, padding, width, height, data.length, 5);
        
        // Draw axes
        this.drawAxes(ctx, padding, width, height);
        
        // Draw data line
        ctx.beginPath();
        ctx.strokeStyle = this.colors.primary;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        data.forEach((point, index) => {
            const x = padding + (index * xStep);
            const y = padding + height - ((point.value - minValue) * yScale);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw data points
        data.forEach((point, index) => {
            const x = padding + (index * xStep);
            const y = padding + height - ((point.value - minValue) * yScale);
            
            // Point circle
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = this.colors.primary;
            ctx.fill();
            
            // Point border
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
        
        // Draw labels
        this.drawLabels(ctx, data, padding, width, height, xStep, yScale, minValue);
        
        // Add gradient fill
        this.addGradientFill(ctx, data, padding, width, height, xStep, yScale, minValue);
    }

    drawGrid(ctx, canvas, padding, width, height, xSteps, ySteps) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        for (let i = 0; i <= xSteps - 1; i++) {
            const x = padding + (i * width / (xSteps - 1));
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + height);
            ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let i = 0; i <= ySteps; i++) {
            const y = padding + (i * height / ySteps);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
        }
    }

    drawAxes(ctx, padding, width, height) {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.stroke();
    }

    drawLabels(ctx, data, padding, width, height, xStep, yScale, minValue) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        // X-axis labels
        data.forEach((point, index) => {
            const x = padding + (index * xStep);
            const y = padding + height + 20;
            ctx.fillText(point.label, x, y);
        });
        
        // Y-axis labels
        ctx.textAlign = 'right';
        const maxValue = Math.max(...data.map(d => d.value));
        const valueRange = maxValue - minValue;
        
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (valueRange * i / 5);
            const y = padding + height - (i * height / 5);
            ctx.fillText(this.formatCurrency(value), padding - 10, y + 4);
        }
    }

    addGradientFill(ctx, data, padding, width, height, xStep, yScale, minValue) {
        // Create gradient
        const gradient = ctx.createLinearGradient(0, padding, 0, padding + height);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');
        
        // Draw filled area
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        
        data.forEach((point, index) => {
            const x = padding + (index * xStep);
            const y = padding + height - ((point.value - minValue) * yScale);
            ctx.lineTo(x, y);
        });
        
        ctx.lineTo(padding + width, padding + height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    formatCurrency(value) {
        return '$' + (value / 1000).toFixed(0) + 'K';
    }

    // Animated counter for KPI cards
    animateCounter(element, start, end, duration = 2000) {
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (end - start) * easeOutQuart);
            
            element.textContent = this.formatNumber(current);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    // Donut chart for categories
    drawDonutChart(ctx, canvas, data, centerText) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        const innerRadius = radius * 0.6;
        
        let currentAngle = -Math.PI / 2;
        const total = data.reduce((sum, item) => sum + item.value, 0);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw segments
        data.forEach((item, index) => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            
            // Draw outer arc
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            
            ctx.fillStyle = this.getColor(index);
            ctx.fill();
            
            currentAngle += sliceAngle;
        });
        
        // Draw center text
        if (centerText) {
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 24px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(centerText.value, centerX, centerY - 5);
            
            ctx.font = '14px Inter, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText(centerText.label, centerX, centerY + 20);
        }
    }

    getColor(index) {
        const colors = [
            this.colors.primary,
            this.colors.success,
            this.colors.warning,
            this.colors.error,
            this.colors.secondary
        ];
        return colors[index % colors.length];
    }

    // Bar chart for comparisons
    drawBarChart(ctx, canvas, data) {
        const padding = 40;
        const width = canvas.width - (padding * 2);
        const height = canvas.height - (padding * 2);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const maxValue = Math.max(...data.map(d => d.value));
        const barWidth = width / data.length * 0.8;
        const barSpacing = width / data.length * 0.2;
        
        data.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * height;
            const x = padding + (index * (barWidth + barSpacing)) + barSpacing / 2;
            const y = padding + height - barHeight;
            
            // Draw bar
            ctx.fillStyle = this.getColor(index);
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw value label
            ctx.fillStyle = '#1e293b';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.value.toLocaleString(), x + barWidth / 2, y - 5);
            
            // Draw category label
            ctx.fillText(item.label, x + barWidth / 2, padding + height + 20);
        });
    }

    // Update chart data with animation
    updateChartData(chartId, newData) {
        const chart = this.charts[chartId];
        if (!chart) return;
        
        // Animate data transition
        this.animateDataTransition(chart, newData);
    }

    animateDataTransition(chart, newData, duration = 1000) {
        const startTime = performance.now();
        const oldData = [...chart.data];
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Interpolate between old and new data
            const currentData = oldData.map((oldPoint, index) => {
                const newPoint = newData[index];
                return {
                    ...oldPoint,
                    value: oldPoint.value + (newPoint.value - oldPoint.value) * progress
                };
            });
            
            // Redraw chart with interpolated data
            this.redrawChart(chart, currentData);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                chart.data = newData;
            }
        };
        
        requestAnimationFrame(animate);
    }

    redrawChart(chart, data) {
        switch (chart.type) {
            case 'line':
                this.drawLineChart(chart.ctx, chart.canvas, data);
                break;
            case 'bar':
                this.drawBarChart(chart.ctx, chart.canvas, data);
                break;
            case 'donut':
                this.drawDonutChart(chart.ctx, chart.canvas, data, chart.centerText);
                break;
        }
    }

    // Responsive chart resizing
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            const canvas = chart.canvas;
            const container = canvas.parentElement;
            
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            
            this.redrawChart(chart, chart.data);
        });
    }
}

// Initialize chart manager
const chartManager = new ChartManager();

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    chartManager.initializeCharts();
});

// Handle window resize
window.addEventListener('resize', () => {
    chartManager.resizeCharts();
});

// Export for global use
window.chartManager = chartManager;

// Legacy function for backward compatibility
function initializeSalesChart() {
    chartManager.initializeSalesChart();
}
