async function executeCommand(ssh, command) {
  
  let prom = new Promise(function(resolve, reject) {

    let ourout = "";

    ssh.exec(command, {
      exit: function() {
        ourout += "\nsuccessfully exited!";
        resolve(ourout);
      },
      out: function(stdout) {
        ourout += stdout;
        resolve(ourout);
      }
    }).start({
      success: function() {
        console.log("successful connection!");
      },
      fail: function(e) {
        console.log("failed connection, boo");
        console.log(e);
      }
    });

  });

  const res = await prom;
  
  return res
}

const delay = ms => new Promise(res => setTimeout(res, ms));

exports.handler = async (event) => {

  const SSH = require('simple-ssh');
  const user = 'ubuntu';
  const serverHost = process.env.serverIp;
  const clientHost = process.env.clientIp
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3();
  const ssm = new AWS.SSM();
  const ec2 = new AWS.EC2({ region: event.instanceRegion });

  let serverStartResults = await ec2.startInstances({ InstanceIds: [process.env.clientInstanceId , process.env.serverInstanceId] }).promise();
  console.log(serverStartResults);
  console.log("Server should be up");

  let ec2WaitParams = {
    InstanceIds: [process.env.clientInstanceId , process.env.serverInstanceId],
    //Waiter configuration
    $waiter: {
        maxAttempts : 1000,
        delay: 10
    }
  };

  let instanceUpResult = await ec2.waitFor("instanceStatusOk", ec2WaitParams).promise();

  //Change this value for number of nodes you want to deploy
  let numberOfNodes = 80;
  let secretCode = 1234;
  let keyName = ''

  const pemKey = await ssm.getParameter({
  	Name: keyName,
  	WithDecryption: true,
  }).promise();
  
  var params = {
    Bucket: process.env.s3BucketName, 
    MaxKeys: 20
  };
  
  let commandList = [];
  
  //Get 20 objects from the s3 bucket
  let alls3Objects = await s3.listObjects(params).promise();
  
  let jarFileName = ""
  
  //For all objects in the s3 bucket add a command to put them on the ec2 instance
  for(let i = 0; i<alls3Objects.Contents.length; i++){
    let objectKey = alls3Objects.Contents[i].Key
    commandList.push(`aws s3 cp s3://${process.env.s3BucketName}/${objectKey} ./${objectKey}`)
    if(objectKey.includes("jar") && objectKey.includes("eval") == false) {
      jarFileName = objectKey;
    }
  }
  
  //Setup network emmulation
  commandList.push(`sudo tc qdisc add dev lo   root netem delay 5msec loss 2.5%`);
  commandList.push(`sudo tc qdisc add dev ens5 root netem delay 5msec loss 2.5%`);
  commandList.push(`bash run_servers.sh ${jarFileName} ${numberOfNodes}`);
  
  await delay(20000);
  
  for(let i = 0; i<commandList.length; i++) {
    // all this config could be passed in via the event
    let ssh = new SSH({
      host: serverHost,
      user: user,
      key: pemKey.Parameter.Value
    });
    
    await executeCommand(ssh, commandList[i]);
    console.log(ssh.count())
  }
  
  let evalJarFileName = ""
  commandList = []
  //For all objects in the s3 bucket add a command to put them on the ec2 instance
  for(let i = 0; i<alls3Objects.Contents.length; i++){
    let objectKey = alls3Objects.Contents[i].Key
    commandList.push(`aws s3 cp s3://${process.env.s3BucketName}/${objectKey} ./${objectKey}`)
    if(objectKey.includes("jar") && objectKey.includes("eval") == false) {
      jarFileName = objectKey;
    }
    if(objectKey.includes("jar") && objectKey.includes("eval") == true) {
      evalJarFileName = objectKey;
    }
  }

  //First line runs our one instance on client side
  //Second line runs the eval client
  //For your own code if u want to run a bash script you can change this to just be one line invoke bash script
  commandList.push(`java -Xmx64m -jar ./${jarFileName} 1`)
  commandList.push(`java -jar ${evalJarFileName} --servers-list ~/servers.txt --secret-code ${secretCode}`)
  
  for(let i = 0; i<commandList.length; i++) {
    // all this config could be passed in via the event
    let ssh = new SSH({
      host: clientHost,
      user: user,
      key: pemKey.Parameter.Value
    });
    
    await executeCommand(ssh, commandList[i]);
  }
}