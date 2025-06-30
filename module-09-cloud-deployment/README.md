# Module 9: Cloud Deployment Strategies

## Learning Objectives
- Master various deployment strategies (Blue-Green, Canary, Rolling)
- Implement multi-cloud and hybrid deployments
- Set up disaster recovery and backup strategies
- Configure auto-scaling and load balancing
- Practice cost optimization techniques

## Topics Covered

### 9.1 Deployment Strategies
- Blue-Green deployments
- Canary releases
- Rolling updates
- A/B testing

### 9.2 Cloud Architecture Patterns
- Multi-region deployments
- Auto-scaling strategies
- Load balancing techniques
- CDN integration

### 9.3 Disaster Recovery
- Backup strategies
- Recovery procedures
- Business continuity planning
- RTO/RPO considerations

## Hands-on Lab: Advanced Deployment Strategies

### Blue-Green Deployment with AWS
```yaml
# aws/blue-green-deployment.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Blue-Green Deployment Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [production, staging]
  
  BlueVersion:
    Type: String
    Description: Current blue version
  
  GreenVersion:
    Type: String
    Description: New green version

Resources:
  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub '${Environment}-alb'
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup

  # Target Groups
  BlueTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub '${Environment}-blue-tg'
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /health
      HealthCheckIntervalSeconds: 30
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 5

  GreenTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub '${Environment}-green-tg'
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /health
      HealthCheckIntervalSeconds: 30
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 5

  # Listener with weighted routing
  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          ForwardConfig:
            TargetGroups:
              - TargetGroupArn: !Ref BlueTargetGroup
                Weight: 100
              - TargetGroupArn: !Ref GreenTargetGroup
                Weight: 0
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 80
      Protocol: HTTP

  # ECS Services
  BlueService:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: !Sub '${Environment}-blue-service'
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref BlueTaskDefinition
      DesiredCount: 3
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref ECSSecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
      LoadBalancers:
        - ContainerName: app
          ContainerPort: 3000
          TargetGroupArn: !Ref BlueTargetGroup

  GreenService:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: !Sub '${Environment}-green-service'
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref GreenTaskDefinition
      DesiredCount: 0
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref ECSSecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
      LoadBalancers:
        - ContainerName: app
          ContainerPort: 3000
          TargetGroupArn: !Ref GreenTargetGroup

  # Task Definitions
  BlueTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '${Environment}-blue-task'
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 512
      Memory: 1024
      ExecutionRoleArn: !Ref ECSExecutionRole
      TaskRoleArn: !Ref ECSTaskRole
      ContainerDefinitions:
        - Name: app
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/ecommerce:${BlueVersion}'
          PortMappings:
            - ContainerPort: 3000
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: VERSION
              Value: !Ref BlueVersion
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref CloudWatchLogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: blue

  GreenTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '${Environment}-green-task'
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 512
      Memory: 1024
      ExecutionRoleArn: !Ref ECSExecutionRole
      TaskRoleArn: !Ref ECSTaskRole
      ContainerDefinitions:
        - Name: app
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/ecommerce:${GreenVersion}'
          PortMappings:
            - ContainerPort: 3000
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: VERSION
              Value: !Ref GreenVersion
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref CloudWatchLogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: green
```

### Canary Deployment Script
```bash
#!/bin/bash
# scripts/canary-deployment.sh

set -e

NAMESPACE="ecommerce"
APP_NAME="backend"
NEW_VERSION=$1
CANARY_PERCENTAGE=${2:-10}

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <new-version> [canary-percentage]"
    exit 1
fi

echo "🚀 Starting canary deployment for version $NEW_VERSION"

# Deploy canary version
echo "📦 Deploying canary version..."
kubectl set image deployment/${APP_NAME}-canary ${APP_NAME}=ecommerce/${APP_NAME}:${NEW_VERSION} -n ${NAMESPACE}

# Wait for canary deployment to be ready
echo "⏳ Waiting for canary deployment..."
kubectl rollout status deployment/${APP_NAME}-canary -n ${NAMESPACE} --timeout=300s

# Update traffic split
echo "🔀 Updating traffic split to ${CANARY_PERCENTAGE}% canary..."
kubectl patch virtualservice ${APP_NAME} -n ${NAMESPACE} --type='json' -p="[
  {
    'op': 'replace',
    'path': '/spec/http/0/match/0/headers/canary/exact',
    'value': 'true'
  },
  {
    'op': 'replace',
    'path': '/spec/http/0/route/0/weight',
    'value': $((100 - CANARY_PERCENTAGE))
  },
  {
    'op': 'replace',
    'path': '/spec/http/0/route/1/weight',
    'value': ${CANARY_PERCENTAGE}
  }
]"

# Monitor canary metrics
echo "📊 Monitoring canary metrics for 5 minutes..."
sleep 300

# Check error rate
ERROR_RATE=$(kubectl exec -n monitoring deployment/prometheus -- \
  promtool query instant 'rate(http_requests_total{status=~"5..",version="'${NEW_VERSION}'"}[5m]) / rate(http_requests_total{version="'${NEW_VERSION}'"}[5m]) * 100' | \
  grep -oP '\d+\.\d+' | head -1)

if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
    echo "❌ High error rate detected: ${ERROR_RATE}%. Rolling back..."
    ./scripts/rollback-canary.sh
    exit 1
fi

# Check response time
RESPONSE_TIME=$(kubectl exec -n monitoring deployment/prometheus -- \
  promtool query instant 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{version="'${NEW_VERSION}'"}[5m]))' | \
  grep -oP '\d+\.\d+' | head -1)

if (( $(echo "$RESPONSE_TIME > 0.5" | bc -l) )); then
    echo "❌ High response time detected: ${RESPONSE_TIME}s. Rolling back..."
    ./scripts/rollback-canary.sh
    exit 1
fi

echo "✅ Canary deployment successful. Metrics look good!"
echo "🎯 To promote to full deployment, run: ./scripts/promote-canary.sh ${NEW_VERSION}"
```

### Auto-scaling Configuration
```yaml
# k8s/autoscaling.yaml
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
  maxReplicas: 50
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
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 5
        periodSeconds: 60
      selectPolicy: Max
---
apiVersion: autoscaling/v1
kind: VerticalPodAutoscaler
metadata:
  name: backend-vpa
  namespace: ecommerce
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: backend
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2
        memory: 2Gi
      controlledResources: ["cpu", "memory"]
```

### Multi-Region Deployment
```yaml
# terraform/multi-region.tf
# Primary region (us-west-2)
provider "aws" {
  alias  = "primary"
  region = "us-west-2"
}

# Secondary region (us-east-1)
provider "aws" {
  alias  = "secondary"
  region = "us-east-1"
}

# Primary region resources
module "primary_infrastructure" {
  source = "./modules/infrastructure"
  
  providers = {
    aws = aws.primary
  }
  
  region      = "us-west-2"
  environment = "production"
  is_primary  = true
}

# Secondary region resources
module "secondary_infrastructure" {
  source = "./modules/infrastructure"
  
  providers = {
    aws = aws.secondary
  }
  
  region      = "us-east-1"
  environment = "production"
  is_primary  = false
}

# Route 53 health checks and failover
resource "aws_route53_health_check" "primary" {
  fqdn                            = module.primary_infrastructure.load_balancer_dns
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = "us-west-2"
  cloudwatch_alarm_name           = "primary-health-check"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "Primary Region Health Check"
  }
}

resource "aws_route53_health_check" "secondary" {
  fqdn                            = module.secondary_infrastructure.load_balancer_dns
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = 3
  request_interval                = 30
  cloudwatch_alarm_region         = "us-east-1"
  cloudwatch_alarm_name           = "secondary-health-check"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "Secondary Region Health Check"
  }
}

# DNS failover configuration
resource "aws_route53_record" "primary" {
  zone_id = var.hosted_zone_id
  name    = "ecommerce.example.com"
  type    = "A"

  set_identifier = "primary"
  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.primary.id

  alias {
    name                   = module.primary_infrastructure.load_balancer_dns
    zone_id                = module.primary_infrastructure.load_balancer_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "secondary" {
  zone_id = var.hosted_zone_id
  name    = "ecommerce.example.com"
  type    = "A"

  set_identifier = "secondary"
  failover_routing_policy {
    type = "SECONDARY"
  }

  health_check_id = aws_route53_health_check.secondary.id

  alias {
    name                   = module.secondary_infrastructure.load_balancer_dns
    zone_id                = module.secondary_infrastructure.load_balancer_zone_id
    evaluate_target_health = true
  }
}
```

### Disaster Recovery Automation
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

BACKUP_BUCKET="ecommerce-backups"
REGION="us-west-2"
DR_REGION="us-east-1"

# Function to create database backup
create_db_backup() {
    echo "📊 Creating database backup..."
    
    BACKUP_NAME="ecommerce-db-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Create RDS snapshot
    aws rds create-db-snapshot \
        --db-instance-identifier ecommerce-database \
        --db-snapshot-identifier $BACKUP_NAME \
        --region $REGION
    
    # Wait for snapshot to complete
    aws rds wait db-snapshot-completed \
        --db-snapshot-identifier $BACKUP_NAME \
        --region $REGION
    
    # Copy snapshot to DR region
    aws rds copy-db-snapshot \
        --source-db-snapshot-identifier arn:aws:rds:$REGION:$(aws sts get-caller-identity --query Account --output text):snapshot:$BACKUP_NAME \
        --target-db-snapshot-identifier $BACKUP_NAME \
        --region $DR_REGION
    
    echo "✅ Database backup completed: $BACKUP_NAME"
}

# Function to backup application data
backup_application_data() {
    echo "💾 Backing up application data..."
    
    # Backup uploaded files
    aws s3 sync s3://ecommerce-uploads s3://$BACKUP_BUCKET/uploads/$(date +%Y%m%d) --region $REGION
    
    # Backup configuration
    kubectl get configmaps,secrets -n ecommerce -o yaml > /tmp/k8s-config-backup.yaml
    aws s3 cp /tmp/k8s-config-backup.yaml s3://$BACKUP_BUCKET/k8s-config/$(date +%Y%m%d)/config.yaml --region $REGION
    
    echo "✅ Application data backup completed"
}

# Function to test DR environment
test_dr_environment() {
    echo "🧪 Testing DR environment..."
    
    # Switch kubectl context to DR cluster
    kubectl config use-context dr-cluster
    
    # Deploy test application
    kubectl apply -f k8s/dr-test/ -n ecommerce-dr
    
    # Wait for deployment
    kubectl wait --for=condition=available deployment/test-app -n ecommerce-dr --timeout=300s
    
    # Run health checks
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://dr.ecommerce.example.com/health)
    
    if [ "$HEALTH_CHECK" = "200" ]; then
        echo "✅ DR environment health check passed"
    else
        echo "❌ DR environment health check failed"
        exit 1
    fi
    
    # Cleanup test resources
    kubectl delete -f k8s/dr-test/ -n ecommerce-dr
}

# Function to failover to DR
failover_to_dr() {
    echo "🚨 Initiating failover to DR region..."
    
    # Update Route 53 to point to DR region
    aws route53 change-resource-record-sets \
        --hosted-zone-id $HOSTED_ZONE_ID \
        --change-batch file://route53-failover.json \
        --region $DR_REGION
    
    # Scale up DR environment
    kubectl config use-context dr-cluster
    kubectl scale deployment backend --replicas=5 -n ecommerce
    kubectl scale deployment frontend --replicas=3 -n ecommerce
    
    # Restore database from latest backup
    LATEST_SNAPSHOT=$(aws rds describe-db-snapshots \
        --db-instance-identifier ecommerce-database \
        --region $DR_REGION \
        --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime) | [-1].DBSnapshotIdentifier' \
        --output text)
    
    aws rds restore-db-instance-from-db-snapshot \
        --db-instance-identifier ecommerce-database-dr \
        --db-snapshot-identifier $LATEST_SNAPSHOT \
        --region $DR_REGION
    
    echo "✅ Failover to DR region completed"
}

# Main execution
case "$1" in
    backup)
        create_db_backup
        backup_application_data
        ;;
    test)
        test_dr_environment
        ;;
    failover)
        failover_to_dr
        ;;
    *)
        echo "Usage: $0 {backup|test|failover}"
        exit 1
        ;;
esac
```

## Assignment
1. Implement blue-green deployment strategy
2. Set up canary releases with automated rollback
3. Configure multi-region deployment with failover
4. Create disaster recovery procedures
5. Implement cost optimization strategies

## Best Practices
- Use infrastructure as code for all deployments
- Implement automated testing at each deployment stage
- Monitor key metrics during deployments
- Have rollback procedures ready
- Test disaster recovery regularly
- Implement proper backup strategies
- Use feature flags for safer deployments
- Monitor costs and optimize regularly

## Resources
- [AWS Deployment Strategies](https://docs.aws.amazon.com/whitepapers/latest/overview-deployment-options/welcome.html)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Disaster Recovery Best Practices](https://aws.amazon.com/disaster-recovery/)
