const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SlippiGame } = require('@slippi/slippi-js');
const { getSettingsData, getFrameData, getConversionsData } = require('./slp-util'); 

const s3 = new S3Client({ region: 'us-east-2' });

// Convert S3 stream to buffer
const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

exports.handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const tempPath = '/tmp/game.slp';
  let frames;
  let settings, playerIndex, opponentIndex;
  let conversions;

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
    const game = new SlippiGame(tempPath);
    console.log('debug:', game);
    const stats = game.getStats();
    const allSettings = getSettingsData(game.getSettings());
    settings = allSettings.jsonl;
    playerIndex = allSettings.playerIndex;
    opponentIndex = allSettings.opponentIndex;
    
    frames = getFrameData(game.getFrames(), playerIndex, opponentIndex);
    conversions = getConversionsData(stats);

  } catch (err) {
    console.log('Error parsing SLP file into JSON:', err);
  }

  try {
    const playerKey = `json/${path.basename(key + '-player').replace(".slp", ".jsonl")}`;
    const opponentKey = `json/${path.basename(key + '-opponent').replace(".slp", ".jsonl")}`;
    const settingsKey = `json/${path.basename(key + '-settings').replace(".slp", ".jsonl")}`;
    const conversionsKey = `json/${path.basename(key + '-conversions').replace(".slp", ".jsonl")}`;

    console.log('Writing JSON to S3');

    const putCommandPlayer = new PutObjectCommand({
      Bucket: bucket,
      Key: playerKey,
      Body: frames.player,
      ContentType: 'text/plain'
    });
    await s3.send(putCommandPlayer);

    const putCommandOpponent = new PutObjectCommand({
      Bucket: bucket,
      Key: opponentKey,
      Body: frames.opponent,
      ContentType: 'text/plain'
    });
    await s3.send(putCommandOpponent);

    const putCommandSettings = new PutObjectCommand({
      Bucket: bucket,
      Key: settingsKey,
      Body: settings,
      ContentType: 'text/plain'
    });
    await s3.send(putCommandSettings);

    const putCommandConversions = new PutObjectCommand({
      Bucket: bucket,
      Key: conversionsKey,
      Body: conversions,
      ContentType: 'text/plain'
    });
    await s3.send(putCommandConversions);
  } catch (err) {
    console.log('Error writing JSON to S3:', err);
  }
  
  return {
    statusCode: 200,
    body: `SLP frame data successfully parsed into JSON and copied to destination bucket`
  };
}
