# The goal of the repo

When testing your CPEN 431 solution you have to run EC2 Instances and a C6A.8Xlarge costs about 1$ an hour.
To reduce development costs the code in this repo will automatically set up AWS infastructure to automatically start your ec2 instance when you click start on a step function in the AWS console.
After 40 minutes the same step function will trigger and turn off your ec2 instances.

# How to Deploy the solution

Go into cdk/bin/cdk-stack.ts and add the RSA key required to access your ec2 instances to line 16.

1. cd cdk
2. configure your aws credentials
3. cdk bootstrap
4. cdk deploy

## What was deployed

![Alt text](./images/Architecture.png?raw=true "Architecture")

As you can see in the above photo the following 4 services were deployed in an effort to simplify setup of the ec2 instances, uploading of the jar files to the server and client, running the eval tests and turning off the ec2 instance.

1. One VPC
2. Two ec2 instances
3. One lambda function
4. One s3 bucket

All the AWS services deployed will not cost more than a few cents and will help save money by shutting down ec2 instances

## What each component does

### VPC
The vpc is a place to store all your AWS services and is needed to have an ec2 instance

### ec2 instances
The two ec2 servers are used to run the eval client

### s3 bucket
The s3 bucket is used as file storage. 
Upload all files you want stored on the ec2 instance to the s3 bucket.
For example the eval client, the assignment jar file, the servers.txt file.

### Lamba function
The first lambda function startEC2 has three variables you need to change:
1. The number of nodes you want to deploy
2. Your secret code
3. The parameter store secret key name. (You find this in the parameter store tab of AWS and it has the pattern /ec2/keypair/{key_pair_id})
The variables to change are on lines 61-64.

The second Lambda function is used to stop the ec2 instance and needs to changes.

### Step function
The step function is used to start the two lambda functions which start and stop the ec2 instance.

The lambda function assumes the eval client and the assignment.jar are uploaded to the s3 bucket and that the eval client has the word eval in its name.

To start the step function open up the console go to the stepfunction tab and click start on the created step function.

## Where to find each deployed solution

In the search bar type "EC2" and click on the ec2 tab. Then click instances. You will find two ec2 instances deployed named client and server. The EC2 instances will never change private and public IP because two elastic IPs were created when the solution was deployed.

![Alt text](./images/EC2Instances.png?raw=true "EC2Instances")

AN RSA Key is attached to both EC2 instances to find your RSA key type parameter store into the search bar.

![Alt text](./images/ParameterStoreCircled.png?raw=true "ParameterStoreCircled")

After clicking parameter store you will see a parameter like this which contains your RSA key. If you click in you are able to click to reveal the value and copy your RSA key into a pem file to ssh into the servers from your own computer.

![Alt text](./images/RSAKeyParamPhoto.png?raw=true "RSAKeyParamPhoto")

If you go to S3 you will see a S3 bucket was deployed in this bucket but your jar files and any other files you want to be uploaded to both servers when you start the step function.

![Alt text](./images/S3BucketPhoto.png?raw=true "S3BucketPhoto")

If you search for lambda and click on functions you will see two Lambda functions were deployed for you. Startec2 and Stopec2

![Alt text](./images/LambdaFunctions.png?raw=true "LambdaFunctions")

If you search step functions you will see a step function was deployed use this to start and stop the servers.

![Alt text](./images/StepFunctions.png?raw=true "StepFunctions")


## Additional notes

The .pem file is storred at /ec2/keypair/{key_pair_id} in parameter store on AWS if you want to ssh on your own into the server