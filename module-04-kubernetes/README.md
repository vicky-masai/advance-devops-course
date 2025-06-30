# Module 4: Container Orchestration with Kubernetes

## Learning Objectives
- Understand Kubernetes architecture and components
- Deploy applications using Kubernetes manifests
- Implement service discovery and load balancing
- Configure auto-scaling and resource management
- Set up monitoring and logging

## Topics Covered

### 4.1 Kubernetes Fundamentals
- Cluster architecture (Master/Worker nodes)
- Pods, Services, Deployments, ConfigMaps, Secrets
- Namespaces and resource quotas
- Networking concepts

### 4.2 Application Deployment
- Deployment strategies (Rolling, Blue-Green, Canary)
- Service mesh concepts
- Ingress controllers
- Persistent volumes and storage

### 4.3 Operations & Monitoring
- Health checks and probes
- Auto-scaling (HPA/VPA)
- Resource limits and requests
- Logging and monitoring setup

## Hands-on Lab: Kubernetes Deployment

### Namespace Configuration
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce
  labels:
    name: ecommerce
    environment: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ecommerce-quota
  namespace: ecommerce
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    persistentvolumeclaims: "10"
    services: "10"
```

### ConfigMap and Secrets
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: ecommerce
data:
  NODE_ENV: "production"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "ecommerce"
  REDIS_URL: "redis://redis-service:6379"
  LOG_LEVEL: "info"
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: ecommerce
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=  # base64 encoded
  JWT_SECRET: bXlzZWNyZXRrZXk=   # base64 encoded
  API_KEY: YWJjZGVmZ2hpams=      # base64 encoded
```

### Database Deployment
```yaml
# postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: ecommerce
  labels:
    app: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: init-script
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
      - name: init-script
        configMap:
          name: postgres-init
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: ecommerce
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: ecommerce
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
```

### Backend Deployment
```yaml
# backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: ecommerce
  labels:
    app: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: ecommerce/backend:v1.2.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
      imagePullSecrets:
      - name: registry-secret
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: ecommerce
  labels:
    app: backend
spec:
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
```

### Frontend Deployment
```yaml
# frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ecommerce
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: ecommerce/frontend:v1.2.0
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_API_URL
          value: "https://api.ecommerce.local"
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: ecommerce
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### Ingress Configuration
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecommerce-ingress
  namespace: ecommerce
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - ecommerce.local
    - api.ecommerce.local
    secretName: ecommerce-tls
  rules:
  - host: ecommerce.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: api.ecommerce.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 80
```

### Horizontal Pod Autoscaler
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: ecommerce
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

### Monitoring Setup
```yaml
# monitoring.yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: backend-metrics
  namespace: ecommerce
  labels:
    app: backend
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
---
apiVersion: v1
kind: Service
metadata:
  name: backend-metrics
  namespace: ecommerce
  labels:
    app: backend
spec:
  selector:
    app: backend
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
```

### Deployment Script
```bash
#!/bin/bash
# deploy.sh

set -e

NAMESPACE="ecommerce"
KUBECTL="kubectl"

echo "🚀 Deploying E-commerce Application to Kubernetes"

# Create namespace
echo "📦 Creating namespace..."
$KUBECTL apply -f namespace.yaml

# Apply ConfigMaps and Secrets
echo "🔧 Applying configuration..."
$KUBECTL apply -f configmap.yaml

# Deploy database
echo "🗄️ Deploying database..."
$KUBECTL apply -f postgres.yaml

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
$KUBECTL wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s

# Deploy backend
echo "🔧 Deploying backend..."
$KUBECTL apply -f backend.yaml

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
$KUBECTL wait --for=condition=ready pod -l app=backend -n $NAMESPACE --timeout=300s

# Deploy frontend
echo "🎨 Deploying frontend..."
$KUBECTL apply -f frontend.yaml

# Apply ingress
echo "🌐 Setting up ingress..."
$KUBECTL apply -f ingress.yaml

# Apply autoscaling
echo "📈 Setting up autoscaling..."
$KUBECTL apply -f hpa.yaml

# Apply monitoring
echo "📊 Setting up monitoring..."
$KUBECTL apply -f monitoring.yaml

echo "✅ Deployment completed successfully!"
echo "🔍 Check status with: kubectl get all -n $NAMESPACE"
```

## Assignment
1. Deploy the e-commerce application to Kubernetes
2. Configure auto-scaling based on CPU and memory
3. Set up ingress with SSL termination
4. Implement health checks and monitoring
5. Practice rolling updates and rollbacks

## Best Practices
- Use resource limits and requests
- Implement proper health checks
- Use namespaces for isolation
- Store sensitive data in Secrets
- Use ConfigMaps for configuration
- Implement proper RBAC
- Monitor resource usage
- Plan for disaster recovery

## Resources
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Helm Charts](https://helm.sh/)
