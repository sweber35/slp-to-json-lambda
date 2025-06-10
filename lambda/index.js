const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { execFile } = require('child_process');

const s3 = new S3Client({ region: 'us-east-2' });

const floatKeys = new Set(['c_x', 'c_y']);

function stringifyWithTargetedFloatCoercion(json) {
  return JSON.stringify(json, (key, value) => {
    if (floatKeys.has(key) && typeof value === 'number') {
      return value.toFixed(2); // returns a string like "0.000000"
    }
    return value;
  }, 2);
}

function roundInteractionDamageValues(obj) {
  if (obj.interaction_damage && typeof obj.interaction_damage === 'object') {
    const rounded = {};
    for (const [key, value] of Object.entries(obj.interaction_damage)) {
      rounded[key] = Math.round(value);
    }
    return {
      ...obj,
      interaction_damage: rounded
    };
  }
  return obj;
}

// Convert S3 stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function sendFilesToS3( startAt, bucket, files ) {
  for await (const file of files) {

    let filePath;

    if (file.key.includes('_')) {
      if (file.key.includes('player')) {
        filePath = `${file.key.split('_')[1]}/player=1`;
      }
      else if (file.key.includes('opponent')) {
        filePath = `${file.key.split('_')[1]}/player=2`;
      }
    }
    else filePath = `${file.key}`;

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: `${filePath}/${startAt}_${file.key}.${file.type}`,
      Body: file.body,
      ContentType: `application/${file.type}`
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
          '-j', outputPath + 'output.json',
          '-f',
          '-a', outputPath + 'analysis.json'
        ],
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error running slippc:', error);
            console.error('stderr:', stderr);
            return reject(new Error(`slippc failed: ${error.message}`));
          }

          console.log('slippc stdout:', stdout);
          console.log('slippc stderr:', stderr);

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

  let startAt;
  let playerFrames, opponentFrames, settings, analysis;
  let playerStats, playerAttacks, playerPunishes;
  let opponentStats, opponentAttacks, opponentPunishes;

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

    await parseWithSlippc(tempPath, '/tmp/');
    // const output = JSON.parse(require('fs').readFileSync('/tmp/output.json', 'utf-8'));
    const output = JSON.parse((require('fs').readFileSync('/tmp/output.json', 'utf-8')));
    analysis = JSON.parse(require('fs').readFileSync('/tmp/analysis.json', 'utf-8'));

    startAt = output.metadata.startAt;
    const playersArray = Object.values(output.metadata.players);
    playerIndex = playersArray.findIndex(player => player.names.code === process.env.SLIPPI_CODE);
    opponentIndex = playersArray.findIndex((player, index) => index !== playerIndex);

    playerFrames = output.players[playerIndex].frames
        .map(obj => stringifyWithTargetedFloatCoercion(obj)).join('\n');

    opponentFrames = output.players[opponentIndex].frames
        .map(obj => JSON.stringify(obj)).join('\n');

    const players = output.metadata.players;

    settings = JSON.stringify({
      slippi_version: output.slippi_version,
      start_time: output.start_time,
      frame_count: output.frame_count,
      winner_id: output.winner_id,
      stage: output.stage,
      end_type: output.end_type,
      player_index: playerIndex,
      player_character: Object.keys(players[playerIndex].characters)[0],
      player_code: players[playerIndex].names.code,
      opponent_index: opponentIndex,
      opponent_character: Object.keys(players[opponentIndex].characters)[0],
      opponent_code: players[opponentIndex].names.code,
    });

    let { attacks: _playerAttacks, punishes: _playerPunishes, ..._playerStats }
        = analysis.players.find( player => player.tag_code === process.env.SLIPPI_CODE);

    playerAttacks = _playerAttacks.map(obj => JSON.stringify(obj)).join('\n');
    playerPunishes = _playerPunishes.map(obj => JSON.stringify(obj)).join('\n');

    playerStats = JSON.stringify(roundInteractionDamageValues(_playerStats));

    let { attacks: _opponentAttacks, punishes: _opponentPunishes, ..._opponentStats }
        = analysis.players.find( player => player.tag_code !== process.env.SLIPPI_CODE);

    opponentAttacks = _opponentAttacks.map(obj => JSON.stringify(obj)).join('\n');
    opponentPunishes = _opponentPunishes.map(obj => JSON.stringify(obj)).join('\n');
    opponentStats = JSON.stringify(roundInteractionDamageValues(_opponentStats));

  } catch (err) {
    console.log('Error parsing SLP file into JSON:', err);
  }

  try {
    console.log('Writing JSON to S3');

    const puts = [
      {
        key: 'settings',
        body: settings,
        type: 'json'
      },
      {
        key: 'player_frames',
        body: playerFrames,
        type: 'jsonl'
      },
      {
        key: 'player_attacks',
        body: playerAttacks,
        type: 'jsonl'
      },
      {
        key: 'player_punishes',
        body: playerPunishes,
        type: 'jsonl'
      },
      {
        key: 'player_stats',
        body: playerStats,
        type: 'json'
      },
      {
        key: 'opponent_frames',
        body: opponentFrames,
        type: 'jsonl'
      },
      {
        key: 'opponent_attacks',
        body: opponentAttacks,
        type: 'jsonl'
      },
      {
        key: 'opponent_punishes',
        body: opponentPunishes,
        type: 'jsonl'
      },
      {
        key: 'opponent_stats',
        body: opponentStats,
        type: 'json'
      },
    ];

    await sendFilesToS3(startAt, bucket, puts);

  } catch (err) {
    console.log('Error writing JSON to S3:', err);
  }

  return {
    statusCode: 200,
    body: `SLP frame data successfully parsed into JSON and copied to destination bucket`
  };
}
