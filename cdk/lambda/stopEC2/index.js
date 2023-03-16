
exports.handler = async (event) => {
    const AWS = require('aws-sdk');
    const ec2 = new AWS.EC2({ region: event.instanceRegion });
  
    let serverStartResults = await ec2.stopInstances({ InstanceIds: [process.env.clientInstanceId , process.env.serverInstanceId] }).promise();
}