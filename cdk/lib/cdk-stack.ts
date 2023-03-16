import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { ArnPrincipal, Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    ////////////////////////////////////
    //Add RSA key for cpen431 here
    let PUB_KEY = "";
    ////////////////////////////////////

    let s3Bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

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

    // Add SSM endpoint to VPC
    vpc.addInterfaceEndpoint("SSM Endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      securityGroups: [defaultSecurityGroup],
      subnets: {subnetType: ec2.SubnetType.PRIVATE_ISOLATED},
    });

    // Add EC2 endpoint to VPC
    vpc.addInterfaceEndpoint("EC2 Endpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.EC2,
      securityGroups: [defaultSecurityGroup],
      subnets: {subnetType: ec2.SubnetType.PRIVATE_ISOLATED},
    });

    //Create a role for lambda to access the postgresql database
    const lambdaRole = new Role(this, 'LambdaRole', {
      roleName: 'LambdaRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    const ec2Role = new Role(this, "ec2Role", {
      roleName: 'ec2Role',
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });

    lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"));
    lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMFullAccess"));
    ec2Role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"));

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

    //Create EC2 Security Group
    let ec2SecuirtyGroup = new ec2.SecurityGroup(this, "ec2SecuirtyGroup", {
      vpc: vpc,
    });
    ec2SecuirtyGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), "Allow all traffic into the ec2 instance");
    ec2SecuirtyGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), "Allow all traffic out of the ec2 instance");

    //This is linux 20.0.4
    const linux = ec2.MachineImage.genericLinux({
      'us-west-1': 'ami-0d221cb540e0015f4',
    });

    //Create pem file for the ec2 instances
    const clientAndServerKey = new ec2.CfnKeyPair(this, 'clientAndServerKey', {
      keyName: 'clientAndServerKey',
    });

    const clientUserData = ec2.UserData.forLinux();
    clientUserData.addCommands(
      'apt install',
      `add-apt-repository ppa:openjdk-r/ppa`,
      `apt install openjdk-17-jre-headless -y`,
      `apt install awscli -y`,
      `echo ${PUB_KEY} >> ~/.ssh/authorized_keys`,
    );

    let clientEc2 = new ec2.Instance(this, 'ClientInstance', {
      instanceName: "Client",
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6A, ec2.InstanceSize.XLARGE8),
      machineImage: linux,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(8),
        },
      ],
      securityGroup: ec2SecuirtyGroup,
      keyName: clientAndServerKey.keyName,
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      userData: clientUserData,
      role: ec2Role,
    });

    //Create elastic ip and associate it with client ec2 instance
    let clientEIP = new ec2.CfnEIP(this, "clientEIP", {
      instanceId: clientEc2.instanceId
    });


    const serverUserData = ec2.UserData.forLinux();
    serverUserData.addCommands(
      'apt install',
      `add-apt-repository ppa:openjdk-r/ppa`,
      `apt install openjdk-17-jre-headless -y`,
      `apt install awscli -y`,
      `echo ${PUB_KEY} >> ~/.ssh/authorized_keys`,
    );

    let serverEc2 = new ec2.Instance(this, 'ServerInstance', {
      instanceName: "Server",
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6A, ec2.InstanceSize.XLARGE8),
      machineImage: linux,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(8),
        },
      ],
      securityGroup: ec2SecuirtyGroup,
      keyName: clientAndServerKey.keyName,
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      userData: serverUserData,
      role: ec2Role,
    });

      //Create elastic ip and associate it with client ec2 instance
    let serverEIP = new ec2.CfnEIP(this, "serverEIP", {
      instanceId: serverEc2.instanceId
    });

    // The layer containing the simple-ssh library
    const simpleSSH = new lambda.LayerVersion(this, 'simpleSSH', {
      code: lambda.Code.fromAsset('lambdaLayers/simpleSSH.zip'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'Contains the simpleSSH library',
    });

    // Create the postgresql db query function.
    const startEC2 = new lambda.Function(this, 'startEC2', {
      functionName: "startEC2",
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(300),
      role: lambdaRole,
      memorySize: 512,
      securityGroups: [ defaultSecurityGroup ],
      vpc: vpc,
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      allowPublicSubnet: true,
      code: lambda.Code.fromAsset('./lambda/startEC2/'),
      environment: {
        "clientIp": clientEc2.instancePrivateDnsName,
        "serverIp": serverEc2.instancePrivateDnsName,
        "clientInstanceId": clientEc2.instanceId,
        "serverInstanceId": serverEc2.instanceId,
        "keyName": clientAndServerKey.ref,
        "s3BucketName": s3Bucket.bucketName
      },
      layers: [simpleSSH]
    });

  }
}
