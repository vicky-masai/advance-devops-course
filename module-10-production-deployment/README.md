# Module 10: Production Deployment & Maintenance

## Learning Objectives
- Deploy enterprise applications to production
- Implement comprehensive monitoring and alerting
- Set up maintenance procedures and runbooks
- Practice incident response and troubleshooting
- Establish operational excellence practices

## Topics Covered

### 10.1 Production Readiness
- Production checklist
- Performance optimization
- Security hardening
- Compliance requirements

### 10.2 Operations & Maintenance
- Runbook creation
- Incident response procedures
- Change management
- Capacity planning

### 10.3 Continuous Improvement
- Post-deployment reviews
- Performance analysis
- Cost optimization
- Team processes

## Hands-on Lab: Complete Production Deployment

### Production Deployment Checklist
```markdown
# Production Deployment Checklist

## Pre-Deployment
- [ ] Code review completed and approved
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security scans completed with no critical issues
- [ ] Performance testing completed
- [ ] Database migrations tested
- [ ] Backup procedures verified
- [ ] Rollback plan documented
- [ ] Monitoring and alerting configured
- [ ] Load testing completed
- [ ] Documentation updated

## Infrastructure
- [ ] Production environment provisioned
- [ ] SSL certificates installed and valid
- [ ] DNS configuration verified
- [ ] Load balancers configured
- [ ] Auto-scaling policies set
- [ ] Security groups configured
- [ ] Network policies applied
- [ ] Secrets management configured
- [ ] Logging aggregation setup
- [ ] Monitoring dashboards created

## Application
- [ ] Environment variables configured
- [ ] Database connections tested
- [ ] External service integrations verified
- [ ] Feature flags configured
- [ ] Health check endpoints working
- [ ] Graceful shutdown implemented
- [ ] Resource limits set
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS policies configured

## Post-Deployment
- [ ] Smoke tests passed
- [ ] Health checks green
- [ ] Monitoring alerts configured
- [ ] Performance metrics baseline established
- [ ] User acceptance testing completed
- [ ] Documentation updated
- [ ] Team notified of deployment
- [ ] Incident response procedures reviewed
```

### Production Deployment Script
```bash
#!/bin/bash
# scripts/production-deploy.sh

set -e

# Configuration
ENVIRONMENT="production"
NAMESPACE="ecommerce"
APP_VERSION=$1
CLUSTER_NAME="production-cluster"
REGION="us-west-2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Validation
if [ -z "$APP_VERSION" ]; then
    error "Usage: $0 <app-version>"
fi

log "🚀 Starting production deployment for version $APP_VERSION"

# Pre-deployment checks
log "🔍 Running pre-deployment checks..."

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    error "kubectl is not configured or cluster is not accessible"
fi

# Check if the image exists
if ! docker manifest inspect "ecommerce/backend:$APP_VERSION" &> /dev/null; then
    error "Docker image ecommerce/backend:$APP_VERSION not found"
fi

# Check cluster health
log "🏥 Checking cluster health..."
kubectl get nodes --no-headers | while read node status; do
    if [ "$status" != "Ready" ]; then
        error "Node $node is not ready"
    fi
done

# Check resource availability
log "📊 Checking resource availability..."
AVAILABLE_CPU=$(kubectl top nodes --no-headers | awk '{sum += $3} END {print sum}')
AVAILABLE_MEMORY=$(kubectl top nodes --no-headers | awk '{sum += $5} END {print sum}')

log "Available CPU: ${AVAILABLE_CPU}m, Available Memory: ${AVAILABLE_MEMORY}Mi"

# Database migration
log "🗄️ Running database migrations..."
kubectl run migration-job-$(date +%s) \
    --image=ecommerce/backend:$APP_VERSION \
    --restart=Never \
    --rm -i \
    --namespace=$NAMESPACE \
    --command -- npm run migrate

# Blue-Green deployment
log "🔄 Starting blue-green deployment..."

# Check current deployment color
CURRENT_COLOR=$(kubectl get service backend-service -n $NAMESPACE -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "blue")
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

log "Current color: $CURRENT_COLOR, New color: $NEW_COLOR"

# Deploy new version
log "📦 Deploying new version to $NEW_COLOR environment..."
envsubst < k8s/production/deployment-${NEW_COLOR}.yaml | kubectl apply -f -

# Wait for deployment to be ready
log "⏳ Waiting for $NEW_COLOR deployment to be ready..."
kubectl rollout status deployment/backend-${NEW_COLOR} -n $NAMESPACE --timeout=600s

# Health checks
log "🏥 Running health checks on $NEW_COLOR environment..."
kubectl wait --for=condition=ready pod -l app=backend,color=$NEW_COLOR -n $NAMESPACE --timeout=300s

# Test new deployment
log "🧪 Testing new deployment..."
NEW_POD=$(kubectl get pods -l app=backend,color=$NEW_COLOR -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
kubectl exec $NEW_POD -n $NAMESPACE -- curl -f http://localhost:3000/health || error "Health check failed"

# Load testing
log "⚡ Running load tests..."
kubectl run load-test-$(date +%s) \
    --image=loadimpact/k6:latest \
    --restart=Never \
    --rm -i \
    --namespace=$NAMESPACE \
    -- run --vus 10 --duration 60s - <<EOF
import http from 'k6/http';
import { check } from 'k6';

export default function() {
    let response = http.get('http://backend-${NEW_COLOR}-service/api/health');
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });
}
EOF

# Switch traffic to new version
log "🔀 Switching traffic to $NEW_COLOR environment..."
kubectl patch service backend-service -n $NAMESPACE -p '{"spec":{"selector":{"color":"'$NEW_COLOR'"}}}'

# Monitor for 5 minutes
log "📊 Monitoring new deployment for 5 minutes..."
for i in {1..10}; do
    sleep 30
    ERROR_RATE=$(kubectl exec -n monitoring deployment/prometheus -- \
        promtool query instant 'rate(http_requests_total{status=~"5..",color="'$NEW_COLOR'"}[2m]) / rate(http_requests_total{color="'$NEW_COLOR'"}[2m]) * 100' | \
        grep -oP '\d+\.\d+' | head -1 || echo "0")
    
    if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
        error "High error rate detected: ${ERROR_RATE}%. Rolling back..."
    fi
    
    log "Monitoring... Error rate: ${ERROR_RATE}% (${i}/10)"
done

# Cleanup old deployment
log "🧹 Cleaning up old $CURRENT_COLOR deployment..."
kubectl delete deployment backend-${CURRENT_COLOR} -n $NAMESPACE --ignore-not-found

# Update monitoring dashboards
log "📈 Updating monitoring dashboards..."
curl -X POST "http://grafana.monitoring.svc.cluster.local:3000/api/annotations" \
    -H "Content-Type: application/json" \
    -d '{
        "text": "Production deployment completed - Version '$APP_VERSION'",
        "tags": ["deployment", "production"],
        "time": '$(date +%s000)'
    }'

# Send notifications
log "📢 Sending deployment notifications..."
curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-type: application/json' \
    --data '{
        "text": "✅ Production deployment completed successfully",
        "attachments": [
            {
                "color": "good",
                "fields": [
                    {"title": "Version", "value": "'$APP_VERSION'", "short": true},
                    {"title": "Environment", "value": "'$ENVIRONMENT'", "short": true},
                    {"title": "Deployed by", "value": "'$(whoami)'", "short": true},
                    {"title": "Time", "value": "'$(date)'", "short": true}
                ]
            }
        ]
    }'

log "✅ Production deployment completed successfully!"
log "🔗 Application URL: https://ecommerce.example.com"
log "📊 Monitoring: https://grafana.example.com"
log "📋 Logs: https://kibana.example.com"
```

### Incident Response Runbook
```markdown
# Incident Response Runbook

## Severity Levels

### P0 - Critical (Complete Outage)
- **Response Time**: 15 minutes
- **Resolution Time**: 4 hours
- **Escalation**: Immediate to on-call engineer and management

### P1 - High (Significant Impact)
- **Response Time**: 1 hour
- **Resolution Time**: 24 hours
- **Escalation**: To on-call engineer

### P2 - Medium (Minor Impact)
- **Response Time**: 4 hours
- **Resolution Time**: 72 hours
- **Escalation**: During business hours

### P3 - Low (No Impact)
- **Response Time**: 24 hours
- **Resolution Time**: 1 week
- **Escalation**: Next business day

## Common Incidents

### Application Not Responding

#### Symptoms
- Health check failures
- High response times
- 5xx errors

#### Investigation Steps
1. Check application logs
   ```bash
   kubectl logs -f deployment/backend -n ecommerce --tail=100
   ```

2. Check resource usage
   ```bash
   kubectl top pods -n ecommerce
   kubectl describe pod <pod-name> -n ecommerce
   ```

3. Check database connectivity
   ```bash
   kubectl exec -it deployment/backend -n ecommerce -- nc -zv postgres-service 5432
   ```

4. Check external dependencies
   ```bash
   kubectl exec -it deployment/backend -n ecommerce -- curl -I https://api.external-service.com
   ```

#### Resolution Steps
1. Scale up replicas if resource constrained
   ```bash
   kubectl scale deployment backend --replicas=10 -n ecommerce
   ```

2. Restart pods if memory leak suspected
   ```bash
   kubectl rollout restart deployment/backend -n ecommerce
   ```

3. Rollback if recent deployment caused issue
   ```bash
   kubectl rollout undo deployment/backend -n ecommerce
   ```

### Database Connection Issues

#### Symptoms
- Connection timeout errors
- Database connection pool exhausted
- Slow query performance

#### Investigation Steps
1. Check database status
   ```bash
   kubectl exec -it postgres-0 -n ecommerce -- pg_isready
   ```

2. Check connection count
   ```bash
   kubectl exec -it postgres-0 -n ecommerce -- psql -c "SELECT count(*) FROM pg_stat_activity;"
   ```

3. Check slow queries
   ```bash
   kubectl exec -it postgres-0 -n ecommerce -- psql -c "SELECT query, query_start FROM pg_stat_activity WHERE state = 'active';"
   ```

#### Resolution Steps
1. Kill long-running queries
   ```bash
   kubectl exec -it postgres-0 -n ecommerce -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query_start < now() - interval '5 minutes';"
   ```

2. Increase connection pool size
   ```bash
   kubectl patch configmap backend-config -n ecommerce -p '{"data":{"DB_POOL_SIZE":"50"}}'
   kubectl rollout restart deployment/backend -n ecommerce
   ```

### High Memory Usage

#### Symptoms
- OOMKilled pods
- High memory utilization alerts
- Slow application performance

#### Investigation Steps
1. Check memory usage
   ```bash
   kubectl top pods -n ecommerce --sort-by=memory
   ```

2. Check memory limits
   ```bash
   kubectl describe pod <pod-name> -n ecommerce | grep -A 5 "Limits:"
   ```

3. Analyze memory leaks
   ```bash
   kubectl exec -it <pod-name> -n ecommerce -- node --inspect=0.0.0.0:9229 server.js
   ```

#### Resolution Steps
1. Increase memory limits
   ```bash
   kubectl patch deployment backend -n ecommerce -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
   ```

2. Enable memory profiling
   ```bash
   kubectl set env deployment/backend NODE_OPTIONS="--max-old-space-size=768" -n ecommerce
   ```

## Post-Incident Review Template

### Incident Summary
- **Date**: 
- **Duration**: 
- **Severity**: 
- **Impact**: 
- **Root Cause**: 

### Timeline
- **Detection**: 
- **Response**: 
- **Mitigation**: 
- **Resolution**: 

### Action Items
- [ ] Immediate fixes
- [ ] Short-term improvements
- [ ] Long-term preventive measures

### Lessons Learned
- What went well?
- What could be improved?
- What should we do differently next time?
```

### Maintenance Procedures
```bash
#!/bin/bash
# scripts/maintenance.sh

set -e

NAMESPACE="ecommerce"

# Function to perform database maintenance
database_maintenance() {
    echo "🗄️ Starting database maintenance..."
    
    # Create backup before maintenance
    kubectl exec postgres-0 -n $NAMESPACE -- pg_dump ecommerce > backup-$(date +%Y%m%d).sql
    
    # Analyze and vacuum database
    kubectl exec postgres-0 -n $NAMESPACE -- psql ecommerce -c "ANALYZE;"
    kubectl exec postgres-0 -n $NAMESPACE -- psql ecommerce -c "VACUUM ANALYZE;"
    
    # Update statistics
    kubectl exec postgres-0 -n $NAMESPACE -- psql ecommerce -c "SELECT pg_stat_reset();"
    
    echo "✅ Database maintenance completed"
}

# Function to clean up old logs
log_cleanup() {
    echo "🧹 Cleaning up old logs..."
    
    # Clean application logs older than 30 days
    find /var/log/ecommerce -name "*.log" -mtime +30 -delete
    
    # Clean Docker logs
    docker system prune -f --filter "until=720h"
    
    # Clean Kubernetes logs
    kubectl delete pods --field-selector=status.phase=Succeeded -n $NAMESPACE
    
    echo "✅ Log cleanup completed"
}

# Function to update certificates
certificate_update() {
    echo "🔒 Updating SSL certificates..."
    
    # Check certificate expiry
    CERT_EXPIRY=$(kubectl get certificate ecommerce-tls -n $NAMESPACE -o jsonpath='{.status.notAfter}')
    DAYS_TO_EXPIRY=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))
    
    if [ $DAYS_TO_EXPIRY -lt 30 ]; then
        echo "Certificate expires in $DAYS_TO_EXPIRY days, renewing..."
        kubectl delete certificate ecommerce-tls -n $NAMESPACE
        kubectl apply -f k8s/certificates.yaml
    else
        echo "Certificate is valid for $DAYS_TO_EXPIRY more days"
    fi
    
    echo "✅ Certificate update completed"
}

# Function to perform security updates
security_updates() {
    echo "🔐 Performing security updates..."
    
    # Update base images
    docker pull node:18-alpine
    docker pull postgres:15-alpine
    docker pull nginx:alpine
    
    # Scan for vulnerabilities
    trivy image ecommerce/backend:latest
    trivy image ecommerce/frontend:latest
    
    # Update Kubernetes
    kubectl version --client
    
    echo "✅ Security updates completed"
}

# Function to optimize performance
performance_optimization() {
    echo "⚡ Running performance optimization..."
    
    # Database query optimization
    kubectl exec postgres-0 -n $NAMESPACE -- psql ecommerce -c "
        SELECT schemaname, tablename, attname, n_distinct, correlation 
        FROM pg_stats 
        WHERE schemaname = 'public' 
        ORDER BY n_distinct DESC LIMIT 10;
    "
    
    # Check slow queries
    kubectl exec postgres-0 -n $NAMESPACE -- psql ecommerce -c "
        SELECT query, mean_time, calls 
        FROM pg_stat_statements 
        ORDER BY mean_time DESC LIMIT 10;
    "
    
    # Optimize Redis
    kubectl exec redis-0 -n $NAMESPACE -- redis-cli CONFIG SET maxmemory-policy allkeys-lru
    
    echo "✅ Performance optimization completed"
}

# Main execution
case "$1" in
    database)
        database_maintenance
        ;;
    logs)
        log_cleanup
        ;;
    certificates)
        certificate_update
        ;;
    security)
        security_updates
        ;;
    performance)
        performance_optimization
        ;;
    all)
        database_maintenance
        log_cleanup
        certificate_update
        security_updates
        performance_optimization
        ;;
    *)
        echo "Usage: $0 {database|logs|certificates|security|performance|all}"
        exit 1
        ;;
esac

echo "🎉 Maintenance completed successfully!"
```

## Final Assignment: Complete Production Deployment

### Requirements
1. Deploy the complete e-commerce application to production
2. Implement all monitoring and alerting
3. Create comprehensive runbooks
4. Set up automated maintenance procedures
5. Conduct load testing and performance optimization
6. Document all procedures and create team training materials

### Deliverables
- [ ] Production-ready application deployment
- [ ] Monitoring dashboards and alerts
- [ ] Incident response procedures
- [ ] Maintenance automation scripts
- [ ] Performance test results
- [ ] Documentation and runbooks
- [ ] Team training presentation

## Course Completion

Congratulations! You have completed the Advanced DevOps Course. You should now be able to:

- ✅ Set up complete DevOps pipelines from development to production
- ✅ Deploy and manage containerized applications at scale
- ✅ Implement comprehensive monitoring and security practices
- ✅ Handle production incidents and maintain system reliability
- ✅ Optimize performance and costs in cloud environments
- ✅ Lead DevOps initiatives in enterprise environments

## Next Steps
- Practice with real-world projects
- Contribute to open-source DevOps tools
- Pursue advanced certifications (AWS, Kubernetes, etc.)
- Share knowledge with the community
- Stay updated with latest DevOps trends and tools

## Resources
- [Site Reliability Engineering Book](https://sre.google/sre-book/table-of-contents/)
- [The Phoenix Project](https://itrevolution.com/the-phoenix-project/)
- [DevOps Handbook](https://itrevolution.com/the-devops-handbook/)
- [Kubernetes in Action](https://www.manning.com/books/kubernetes-in-action)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
