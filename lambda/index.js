const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { execFile } = require('child_process');

const s3 = new S3Client({ region: 'us-east-2', defaultsMode: "legacy" });

// Convert S3 stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function sendFilesToS3( startAt, bucket, files ) {
  const fs = require('fs');
  for await (const file of files) {

    const { key } = file;

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: `${key}/${startAt}_${key}.${file.type }`,
      Body: fs.createReadStream(`/tmp/${key}.${file.type}`, 'utf-8'),
      ContentType: `application/${file.type}`
    });
    await s3.send(putCommand);
  }
}

async function sendStreamsToS3( startAt, bucket, streams ) {
  const fs = require('fs');
  for await (const stream of streams) {

    const { key } = stream;

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: `${key}/${startAt}_${key}.${stream.type }`,
      Body: fs.createReadStream(`/tmp/${key}.${stream.type}`),
      ContentType: `application/octet-stream`
    });
    await s3.send(putCommand);
  }
}

function parseWithSlippc(inputPath, outputPath) {
  const slippcPath = path.join(__dirname, 'slippc');

  return new Promise((resolve, reject) => {
    execFile(
        slippcPath,
        [
          '-i', inputPath,
          '-j', outputPath,
          '-a', outputPath + '/analysis.json',
          '-f',
        ],
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error running slippc:', error);
            console.error('stderr:', stderr);
            return reject(new Error(`slippc failed: ${error.message}`));
          }

          if (stdout) console.log('slippc stdout:', stdout);
          if (stderr) console.log('slippc stderr:', stderr);

          resolve({
            stdout,  // usually empty if slippc only writes to files
            stderr,
            outputJsonPath: outputPath + 'output.json',
            analysisJsonPath: outputPath + 'analysis.json'
          });
        }
    );
  });
}

exports.handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const tempPath = '/tmp/game.slp';

  try {
    console.log('Retrieving SLP file from S3:', key);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    const buffer = await streamToBuffer(response.Body);

    console.log('Writing SLP file to /tmp');
    await fs.writeFile(tempPath, buffer);

  } catch (err) {
    console.log('Error retrieving SLP file from S3:', err);
  }

  try {
    console.log('Parsing SLP file into JSON');

    await parseWithSlippc(tempPath, '/tmp');
    console.log('Slippc Done!');

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: `error.log`,
      Body: fs.createReadStream(`/tmp/error.log`),
      ContentType: `text/plain`
    });
    await s3.send(putCommand);

  } catch (err) {
    console.log('Error parsing SLP file into JSON:', err);
  }

  try {
    console.log('Writing JSON to S3');

    const settings = JSON.parse((require('fs').readFileSync('/tmp/settings.json', 'utf-8')));
    const startAt = settings.match_id;
    const stageIsFod = settings.stage === 2;

    const puts = [
      { key: 'frames',   type: 'jsonl' },
      { key: 'items',    type: 'jsonl' },
      { key: 'attacks',  type: 'jsonl' },
      { key: 'punishes', type: 'jsonl' },
      { key: 'stats',    type: 'json' },
      { key: 'settings', type: 'json' },
      // { key: 'example',  type: 'parquet' }
    ];
    if (stageIsFod) {
      puts.push({ key: 'platforms', type: 'jsonl' });
    }

    await sendFilesToS3(startAt, bucket, puts);

    const streams = [
      { key: 'frames', type: 'parquet' }
    ];

    await sendStreamsToS3(startAt, bucket, streams);

  } catch (err) {
    console.log('Error writing JSON to S3:', err);
  }

  return {
    statusCode: 200,
    body: `SLP frame data successfully parsed into JSON and copied to destination bucket`
  };
}
