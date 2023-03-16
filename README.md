# How to Deploy the solution

Go into cdk-stack.ts and add the RSA key required to access your ec2 instances

1. cd cdk
2. configure your aws credentials
3. cdk bootstrap
4. cdk deploy

## What was deployed

1. Two ec2 instances
2. One lambda function
3. One s3 bucket

## What each component does

### ec2 instances
The two ec2 servers are used to run the eval client

### s3 bucket
The s3 bucket is used as file storage. 
Upload all files you want stored on the ec2 instance to the s3 bucket.
For example the eval client, the assignment jar file, the servers.txt file.

### Lamba function
The Lambda function has three variables you need to change:
1. The number of nodes you want to deploy
2. Your secret code
3. The parameter store secret key name. (You find this in the parameter store tab of AWS and it has the pattern /ec2/keypair/{key_pair_id})

The lambda function assumes the eval client and the assignment.jar are uploaded to the s3 bucket and that the eval client has the word eval in its name.


## Additional notes

The .pem file is storred at /ec2/keypair/{key_pair_id} in parameter store on AWS

Add layer to cdk for lambda not there yet!