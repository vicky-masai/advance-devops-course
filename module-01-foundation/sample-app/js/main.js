// Enterprise E-commerce Dashboard JavaScript
class EcommerceDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.orders = [];
        this.products = [];
        this.customers = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.setupNavigation();
        this.initializeCharts();
    }

    setupEventListeners() {
        // Navigation event listeners
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('href').substring(1);
                this.navigateToSection(section);
            });
        });

        // Date filter change
        const dateRange = document.getElementById('dateRange');
        if (dateRange) {
            dateRange.addEventListener('change', (e) => {
                this.filterDataByDate(e.target.value);
            });
        }

        // User profile dropdown
        document.querySelector('.user-profile').addEventListener('click', () => {
            this.toggleUserDropdown();
        });

        // Sidebar menu items
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleQuickAction(e.target.closest('a'));
            });
        });
    }

    setupNavigation() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            const section = e.state?.section || 'dashboard';
            this.navigateToSection(section, false);
        });

        // Set initial state
        history.replaceState({ section: 'dashboard' }, '', '#dashboard');
    }

    navigateToSection(section, pushState = true) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[href="#${section}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Update browser history
        if (pushState) {
            history.pushState({ section }, '', `#${section}`);
        }

        this.currentSection = section;
        this.loadSectionData(section);
    }

    async loadInitialData() {
        this.showLoading();
        
        try {
            // Simulate API calls
            await Promise.all([
                this.loadOrders(),
                this.loadProducts(),
                this.loadCustomers(),
                this.loadAnalytics()
            ]);
            
            this.renderDashboard();
        } catch (error) {
            this.showToast('Error loading dashboard data', 'error');
            console.error('Error loading initial data:', error);
        } finally {
            this.hideLoading();
        }
    }

    async loadOrders() {
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                this.orders = [
                    {
                        id: 'ORD-001',
                        customer: 'John Doe',
                        product: 'Wireless Headphones',
                        amount: 299.99,
                        status: 'completed',
                        date: '2024-01-15'
                    },
                    {
                        id: 'ORD-002',
                        customer: 'Jane Smith',
                        product: 'Smart Watch',
                        amount: 399.99,
                        status: 'pending',
                        date: '2024-01-14'
                    },
                    {
                        id: 'ORD-003',
                        customer: 'Mike Johnson',
                        product: 'Laptop Stand',
                        amount: 79.99,
                        status: 'completed',
                        date: '2024-01-13'
                    },
                    {
                        id: 'ORD-004',
                        customer: 'Sarah Wilson',
                        product: 'Wireless Mouse',
                        amount: 49.99,
                        status: 'cancelled',
                        date: '2024-01-12'
                    },
                    {
                        id: 'ORD-005',
                        customer: 'David Brown',
                        product: 'USB-C Hub',
                        amount: 89.99,
                        status: 'pending',
                        date: '2024-01-11'
                    }
                ];
                resolve(this.orders);
            }, 500);
        });
    }

    async loadProducts() {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.products = [
                    {
                        id: 'PROD-001',
                        name: 'Wireless Headphones',
                        price: 299.99,
                        stock: 45,
                        sold: 156,
                        category: 'Electronics'
                    },
                    {
                        id: 'PROD-002',
                        name: 'Smart Watch',
                        price: 399.99,
                        stock: 23,
                        sold: 124,
                        category: 'Wearables'
                    },
                    {
                        id: 'PROD-003',
                        name: 'Laptop Stand',
                        price: 79.99,
                        stock: 67,
                        sold: 89,
                        category: 'Accessories'
                    }
                ];
                resolve(this.products);
            }, 300);
        });
    }

    async loadCustomers() {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.customers = [
                    { id: 'CUST-001', name: 'John Doe', email: 'john@example.com', orders: 5 },
                    { id: 'CUST-002', name: 'Jane Smith', email: 'jane@example.com', orders: 3 },
                    { id: 'CUST-003', name: 'Mike Johnson', email: 'mike@example.com', orders: 7 }
                ];
                resolve(this.customers);
            }, 200);
        });
    }

    async loadAnalytics() {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.analytics = {
                    revenue: 124567,
                    orders: 1234,
                    customers: 5678,
                    products: 2456,
                    salesTrend: [
                        { date: '2024-01-01', sales: 12000 },
                        { date: '2024-01-02', sales: 15000 },
                        { date: '2024-01-03', sales: 18000 },
                        { date: '2024-01-04', sales: 14000 },
                        { date: '2024-01-05', sales: 22000 },
                        { date: '2024-01-06', sales: 19000 },
                        { date: '2024-01-07', sales: 25000 }
                    ]
                };
                resolve(this.analytics);
            }, 400);
        });
    }

    renderDashboard() {
        this.renderOrdersTable();
        this.updateKPICards();
    }

    renderOrdersTable() {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.orders.map(order => `
            <tr>
                <td><strong>${order.id}</strong></td>
                <td>${order.customer}</td>
                <td>${order.product}</td>
                <td>$${order.amount.toFixed(2)}</td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                <td>${this.formatDate(order.date)}</td>
                <td>
                    <button class="btn btn-secondary" onclick="dashboard.viewOrder('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateKPICards() {
        // Update KPI values with animation
        this.animateValue('kpi-revenue', 0, this.analytics.revenue, 1000);
        this.animateValue('kpi-orders', 0, this.analytics.orders, 800);
        this.animateValue('kpi-customers', 0, this.analytics.customers, 1200);
        this.animateValue('kpi-products', 0, this.analytics.products, 600);
    }

    animateValue(elementId, start, end, duration) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (end - start) * progress);
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
        return num.toString();
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    filterDataByDate(range) {
        this.showLoading();
        
        // Simulate filtering data based on date range
        setTimeout(() => {
            console.log(`Filtering data for: ${range}`);
            this.showToast(`Data filtered for ${range}`, 'success');
            this.hideLoading();
        }, 500);
    }

    handleQuickAction(element) {
        const action = element.textContent.trim();
        
        switch (action) {
            case 'Add Product':
                this.showAddProductModal();
                break;
            case 'New Order':
                this.showNewOrderModal();
                break;
            case 'Add Customer':
                this.showAddCustomerModal();
                break;
            case 'Settings':
                this.navigateToSection('settings');
                break;
            default:
                this.showToast(`${action} clicked`, 'info');
        }
    }

    showAddProductModal() {
        this.showToast('Add Product modal would open here', 'info');
    }

    showNewOrderModal() {
        this.showToast('New Order modal would open here', 'info');
    }

    showAddCustomerModal() {
        this.showToast('Add Customer modal would open here', 'info');
    }

    viewOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (order) {
            this.showToast(`Viewing order: ${orderId}`, 'info');
            console.log('Order details:', order);
        }
    }

    toggleUserDropdown() {
        // Implementation for user dropdown menu
        this.showToast('User menu would open here', 'info');
    }

    loadSectionData(section) {
        // Load data specific to the section
        switch (section) {
            case 'products':
                this.loadProductsSection();
                break;
            case 'orders':
                this.loadOrdersSection();
                break;
            case 'customers':
                this.loadCustomersSection();
                break;
            case 'analytics':
                this.loadAnalyticsSection();
                break;
        }
    }

    loadProductsSection() {
        console.log('Loading products section...');
    }

    loadOrdersSection() {
        console.log('Loading orders section...');
    }

    loadCustomersSection() {
        console.log('Loading customers section...');
    }

    loadAnalyticsSection() {
        console.log('Loading analytics section...');
    }

    initializeCharts() {
        // Chart initialization will be handled in charts.js
        if (typeof initializeSalesChart === 'function') {
            initializeSalesChart();
        }
    }

    showLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        }
    }

    hideLoading() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new EcommerceDashboard();
});

// Handle responsive sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

// Add mobile menu button functionality
if (window.innerWidth <= 1024) {
    const header = document.querySelector('.header-container');
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '<i class="fas fa-bars"></i>';
    menuButton.className = 'mobile-menu-btn';
    menuButton.onclick = toggleSidebar;
    header.insertBefore(menuButton, header.firstChild);
}

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
        document.querySelector('.sidebar').classList.remove('open');
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EcommerceDashboard;
}
