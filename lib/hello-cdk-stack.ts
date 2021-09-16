import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import {readFileSync} from 'fs';

export class HelloCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

      // The code that defines your stack goes here

      // IAM & OS users
      let usersArray: string[] = [];
      for (let n = 1; n < 11; n++) {
          usersArray.push('user' + ('000' + n).slice(-3));
      }
      // Create IAM users
      for (let userName of usersArray) {
          const policy = new iam.Policy(this, `${userName}Policy`, {
              policyName: `${userName}Policy`,
              statements: [
                  new iam.PolicyStatement({
                      resources: ['*'],
                      actions: [
                          'ec2-instance-connect:SendSSHPublicKey',
                      ],
                      effect: iam.Effect.ALLOW,
                      conditions: {
                          'StringEquals' : {
                              'ec2:osuser' : userName,
                          },
                      },
                  }),
                  new iam.PolicyStatement({
                      resources: ['*'],
                      actions: [
                          'ec2:Describe*',
                      ],
                      effect: iam.Effect.ALLOW,
                  }),
                  new iam.PolicyStatement({
                      resources: ['*'],
                      actions: [
                          'cloudwatch:ListMetrics',
                          'cloudwatch:GetMetricStatistics',
                          'cloudwatch:Describe*',
                      ],
                      effect: iam.Effect.ALLOW,
                  }),
              ],
          })
          const user = new iam.User(this, userName, {
              userName,
              password: cdk.SecretValue.plainText('handson0918!'),
              passwordResetRequired: true,
              managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('IAMUserChangePassword')],
          })
          user.attachInlinePolicy(policy);
      }

      // Create new vpc with 2 subnet
      const vpc = new ec2.Vpc(this, 'VPC', {
          natGateways: 0,
          subnetConfiguration: [{
                  cidrMask: 24,
                  name: "public",
                  subnetType: ec2.SubnetType.PUBLIC,
          }]
      });

      // Allow HTTP (TCP Port 8080-8090) access and SSH (TCP Port 22) access from Instance Connet Console
      const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
          vpc,
          description: 'Allow HTTP(TCP port 8080 - 8090) in and SSH (TCP port 22) in with Instance Connect',
          allowAllOutbound: true
      });
      securityGroup.addIngressRule(ec2.Peer.ipv4("3.112.23.0/29"), ec2.Port.tcp(22), 'Allow SSH Access')
      for (let i = 8080; i < 8091; i++) {
          securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(i), 'Allow HTPP Access')
      }

      // Use Latest Amazon Linux 2 image
      const ami = new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          cpuType: ec2.AmazonLinuxCpuType.ARM_64
      })

      // IAM role for Security
      const role = new iam.Role(this, 'ec2Role', {
          assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
          managedPolicies: [
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonPollyReadOnlyAccess'),
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRekognitionReadOnlyAccess'),
              iam.ManagedPolicy.fromAwsManagedPolicyName('TranslateReadOnly'),
          ]
      })

      // userdata
      const userData = ec2.UserData.forLinux({shebang: '#!/bin/bash -xe'});
      const script = readFileSync(`${__dirname}/../src/config.sh`, 'utf8');
      userData.addCommands(...script.split('\n'));
      for (let userName of usersArray) {
          userData.addCommands(
              `adduser ${userName} -m -s /bin/bash`,
              `cp -r serv-sh /home/${userName}/`,
              `cp -r sample  /home/${userName}/`,
              `chown -R ${userName}:${userName} /home/${userName}/serv-sh`,
              `chown -R ${userName}:${userName} /home/${userName}/sample`,
          );
      }


      // Create the instance using the Security Group, AMI defined in the VPC created.
      const ec2Instance = new ec2.Instance(this, 'Instance', {
          vpc,
          vpcSubnets: {
              subnetType: ec2.SubnetType.PUBLIC,
          },
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
          machineImage: ami,
          securityGroup,
          role,
          userData
      });


      // Create S3 bucket
      const s3Buclet = new s3.Bucket(this, 'Bucket', {
          versioned: false,
          bucketName: 'shz-workshop',
          publicReadAccess: false,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
      })
  }
}
