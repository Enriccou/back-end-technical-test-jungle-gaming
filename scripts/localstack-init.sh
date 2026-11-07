#!/bin/bash

echo "Initializing LocalStack SQS queues..."

# Create FIFO queues
awslocal sqs create-queue \
  --queue-name wager-transactions.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=false

awslocal sqs create-queue \
  --queue-name wager-transactions-dlq.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=false

echo "SQS queues initialized successfully"
