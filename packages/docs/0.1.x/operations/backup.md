# Backup and Recovery

This guide covers backup strategies and disaster recovery procedures for Fluent applications.

## Database Backup

### PostgreSQL Backup
```bash
#!/bin/bash
# backup-postgres.sh

DB_NAME="fluent_prod"
DB_USER="fluent"
DB_HOST="localhost"
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -b -v -f $BACKUP_DIR/backup_$DATE.backup

# Compress and encrypt
gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output $BACKUP_DIR/backup_$DATE.backup.gpg $BACKUP_DIR/backup_$DATE.backup

# Clean up old backups
find $BACKUP_DIR -name "*.backup" -type f -mtime +7 -delete
find $BACKUP_DIR -name "*.backup.gpg" -type f -mtime +30 -delete
```

### Automated Backup
```yaml
# k8s-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:14
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgres-service -U fluent -d fluent > /backup/backup_$(date +%Y%m%d_%H%M%S).sql
              aws s3 cp /backup/backup_$(date +%Y%m%d_%H%M%S).sql s3://fluent-backups/
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          volumes:
          - name: backup-volume
            emptyDir: {}
          restartPolicy: OnFailure
```

## File Backup

### Application Data
```bash
# backup-files.sh
#!/bin/bash

SOURCE_DIR="/app/uploads"
BACKUP_DIR="/var/backups/files"
DATE=$(date +%Y%m%d_%H%M%S)

# Create incremental backup
rsync -av --delete --backup --backup-dir=$BACKUP_DIR/incremental_$DATE $SOURCE_DIR/ $BACKUP_DIR/current/

# Sync to S3
aws s3 sync $BACKUP_DIR/current/ s3://fluent-backups/files/
```

### Container Volumes
```bash
# Backup Docker volumes
docker run --rm -v fluent_data:/data -v $(pwd):/backup alpine tar czf /backup/data_backup.tar.gz /data

# Backup Kubernetes PVCs
kubectl exec -it backup-pod -- tar czf /backup/pvc_backup.tar.gz /data
```

## Recovery Procedures

### Database Recovery
```bash
# Restore from backup
pg_restore -h localhost -U fluent -d fluent_prod -v backup_20231201_020000.backup

# Point-in-time recovery
pg_basebackup -h localhost -U postgres -D /var/lib/postgresql/recovery -P -W
```

### Application Recovery
```bash
# Restore application data
tar xzf data_backup.tar.gz -C /app/uploads

# Rolling deployment
kubectl rollout restart deployment/fluent-app
```

## Disaster Recovery

### RTO and RPO Targets
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour

### Recovery Strategy
1. **Immediate**: Restore from latest backup
2. **Full Recovery**: Rebuild from infrastructure as code
3. **Failover**: Switch to secondary region

### Testing
```bash
# Test backup integrity
pg_restore --list backup_20231201_020000.backup

# Test recovery procedure
kubectl apply -f disaster-recovery/
```

## Monitoring
```yaml
# Backup monitoring
- alert: BackupFailed
  expr: backup_success == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Backup failed"
    description: "Database backup has failed"
```