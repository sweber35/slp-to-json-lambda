const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { execFile } = require('child_process');

const s3 = new S3Client({ region: 'us-east-2' });

// Convert S3 stream to buffer
const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

function parseWithSlippc(inputPath, outputPath) {
  const slippcPath = path.join(__dirname, 'slippc');

  return new Promise((resolve, reject) => {
    // -f argument tells slippc to output data on the whole frame, instead of just the changes since last frame.
    // While it makes the files quite a bit larger, I think it will ultimately be worth the simplicity during analysis
    execFile(slippcPath, ['-i', inputPath, '-j', outputPath, '-f'], (error, stdout, stderr) => {
      if (error) {
        return reject(`Error running slippc: ${error.message}`);
      }
      resolve({ stdout, stderr });
    });
  });
}

exports.handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const tempPath = '/tmp/game.slp';

  let startAt;
  let playerFrames, opponentFrames;//, settings, conversions;
  let playerIndex, opponentIndex;

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
    const outputPath = '/tmp/output.json';

    await parseWithSlippc(tempPath, outputPath);
    const output = JSON.parse(require('fs').readFileSync(outputPath, 'utf-8'));

    startAt = output.metadata.startAt;
    playerIndex = output.metadata.players.findIndex(player => player.names.code === process.env.SLIPPI_CODE);
    opponentIndex = output.metadata.players.findIndex(player => player.name.code !== process.env.SLIPPI_CODE);

    playerFrames = output.players[playerIndex].frames
          .map(obj => JSON.stringify(obj)).join('\n');

    opponentFrames = output.players[opponentIndex].frames
        .map(obj => JSON.stringify(obj)).join('\n');

  } catch (err) {
    console.log('Error parsing SLP file into JSON:', err);
  }

  try {
    const playerKey = `json/${startAt}_player_frames.jsonl`;
    const opponentKey = `json/${startAt}_opponent_frames.jsonl`;
    // const settingsKey = `json/${path.basename(key + '-settings').replace(".slp", ".jsonl")}`;
    // const conversionsKey = `json/${path.basename(key + '-conversions').replace(".slp", ".jsonl")}`;
    // const slippcKey = `json/${path.basename(key).replace(".slp", "_player_frames.json")}`;
    console.log('Writing JSON to S3');

    const putPlayerFramesCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: playerKey,
      Body: playerFrames,
      ContentType: 'text/plain',
    });
    await s3.send(putPlayerFramesCommand);

    const putOpponentFramesCommandPlayer = new PutObjectCommand({
      Bucket: bucket,
      Key: opponentKey,
      Body: opponentFrames,
      ContentType: 'text/plain'
    });
    await s3.send(putOpponentFramesCommandPlayer);
    //
    // const putCommandOpponent = new PutObjectCommand({
    //   Bucket: bucket,
    //   Key: opponentKey,
    //   Body: frames.opponent,
    //   ContentType: 'text/plain'
    // });
    // await s3.send(putCommandOpponent);
    //
    // const putCommandSettings = new PutObjectCommand({
    //   Bucket: bucket,
    //   Key: settingsKey,
    //   Body: settings,
    //   ContentType: 'text/plain'
    // });
    // await s3.send(putCommandSettings);
    //
    // const putCommandConversions = new PutObjectCommand({
    //   Bucket: bucket,
    //   Key: conversionsKey,
    //   Body: conversions,
    //   ContentType: 'text/plain'
    // });
    // await s3.send(putCommandConversions);
  } catch (err) {
    console.log('Error writing JSON to S3:', err);
  }

  return {
    statusCode: 200,
    body: `SLP frame data successfully parsed into JSON and copied to destination bucket`
  };
}
