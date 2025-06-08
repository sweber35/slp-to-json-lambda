exports.getSettingsData = function (settings) {
    const allPlayerSettings = settings.players.find(player => player.userId === process.env.SLIPPI_USER_ID);
    const playerSettings = {
        type: 'player',
        playerIndex: allPlayerSettings.playerIndex,
        characterId: allPlayerSettings.characterId,
        stageId: settings.stageId
    }
    const allOpponentSettings = settings.players.find(player => player !== null && player.userId !== process.env.SLIPPI_USER_ID);
    const opponentSettings = {
        type: 'opponent',
        playerIndex: allOpponentSettings.playerIndex,
        characterId: allOpponentSettings.characterId,
        stageId: settings.stageId
    }
    return {
        jsonl: [playerSettings, opponentSettings].map(obj => JSON.stringify(obj)).join('\n'),
        playerIndex: playerSettings.playerIndex,
        opponentIndex: opponentSettings.playerIndex
    }
}

exports.getFrameData = function (frames, playerIndex, opponentIndex) {
    const transformedPlayerFrames = [];
    for (let key in frames) {
        const flattenedPlayerFrameObject = {};
        const playerFrame = frames[key].players[playerIndex];
        for (const [key, val] of Object.entries(playerFrame.pre)) {
            flattenedPlayerFrameObject['pre_' + key] = val;
        }
        for (const [key, val] of Object.entries(playerFrame.post)) {
            flattenedPlayerFrameObject['post_' + key] = val;
        }
        delete flattenedPlayerFrameObject['post_selfInducedSpeeds'];
        transformedPlayerFrames.push(flattenedPlayerFrameObject);
    }
  
    const transformedOpponentFrames = [];
    for (let key in frames) {
        const flattenedOpponentFrameObject = {};
        const opponentFrame = frames[key].players[opponentIndex];
        for (const [key, val] of Object.entries(opponentFrame.pre)) {
            flattenedOpponentFrameObject['pre_' + key] = val;
        }
        for (const [key, val] of Object.entries(opponentFrame.post)) {
            flattenedOpponentFrameObject['post_' + key] = val;
        }
        delete flattenedOpponentFrameObject['post_selfInducedSpeeds'];
        transformedOpponentFrames.push(flattenedOpponentFrameObject);
    }
  
    return {
        player: transformedPlayerFrames.map(obj => JSON.stringify(obj)).join('\n'),
        opponent: transformedOpponentFrames.map(obj => JSON.stringify(obj)).join('\n')
    }
}

exports.getConversionsData = function (stats) {
    const withFlattenedMoves = stats.conversions.map( conversion => {
        const movesObject = Object.fromEntries(conversion.moves.map((item, index) => [index, item]));
        const flattenedMoves = {};
        for (const [key, val] of Object.entries(movesObject)) {
            for (const [subkey, subval] of Object.entries(val)) {
                flattenedMoves[`moves_${key}_${subkey}`] = subval;
            }
        }
        const { moves, ...conversionWithoutMoves } = conversion;
        return { ...conversionWithoutMoves, ...flattenedMoves };
    });
  
    return withFlattenedMoves.map(obj => JSON.stringify(obj)).join('\n');
}
  