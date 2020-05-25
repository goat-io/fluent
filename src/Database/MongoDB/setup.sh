#!/bin/bash
USER=$MONGO_DB_USER
PASS=$MONGO_DB_PASSWORD
DB=$MONGO_INITDB_DATABASE

# Create User
echo "Creating user: \"$USER\"..."
mongo $DB --eval "db.createUser({ user: '$USER', pwd: '$PASS', roles: ['readWrite', 'dbAdmin'] });"
mongo $DB --eval "db.createCollection('log', { capped: true, size: 5242880, max: 5000 });"
#Creating MongoExporter User
mongo $DB --eval "db.getSiblingDB('admin').({ user: 'mongodb_exporter', pwd: 's3cr3tpassw0rd', roles: [{ role: 'clusterMonitor', db: 'admin' }, { role: 'read', db: $DB }] });"

echo "========================================================================"
echo "MongoDB User: \"$USER\""
echo "MongoDB Password: \"$PASS\""
echo "MongoDB Database: \"$DB\""
echo "========================================================================"
