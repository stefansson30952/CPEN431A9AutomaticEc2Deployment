import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { ArnPrincipal, Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for application
    let vpc = new ec2.Vpc(this, 'VPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'isolated-subnet-1',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ],
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    const defaultSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, id, vpc.vpcDefaultSecurityGroup);

    //Create a role for lambda to access the postgresql database
    const lambdaRole = new Role(this, 'LambdaRole', {
      roleName: 'LambdaRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses"
      ],
      resources: ['*'] // must be *
    }));
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        //Logs
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: ["arn:aws:logs:*:*:*"]
    }));

    // Create the postgresql db query function.
    const queryDbFunction = new lambda.Function(this, 'startEC2', {
      functionName: "startEC2",
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'lambda_handler',
      timeout: cdk.Duration.seconds(300),
      role: lambdaRole,
      memorySize: 512,
      securityGroups: [ defaultSecurityGroup ],
      vpc: vpc,
      code: lambda.Code.fromAsset('./lambda/startEC2/'),
    });

  }
}
