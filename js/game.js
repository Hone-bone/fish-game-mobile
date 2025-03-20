document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM読み込み完了");

  // ゲーム状態
  let gameState = {
    isPlaying: false,
    score: 0,
    timeRemaining: 60,
    timeInterval: null,
    fish: [],
    lastTouchX: 0,
    lastTouchY: 0,
    isTimeWarning: false,
    devicePixelRatio: window.devicePixelRatio || 1,
  };

  // ゲーム要素の取得
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const poiContainer = document.getElementById("poi-container");
  const poiElement = document.getElementById("poi");
  const splashContainer = document.getElementById("splash-container");
  const startButton = document.getElementById("start-button");
  const scoreElement = document.getElementById("score");
  const timerElement = document.getElementById("timer");
  const gameOverScreen = document.getElementById("game-over");
  const finalScoreElement = document.getElementById("final-score");
  const restartButton = document.getElementById("restart-button");
  const shareButton = document.getElementById("share-button");

  console.log("要素取得完了", { startButton, poiElement, canvas });

  // キャンバスサイズの設定
  function resizeCanvas() {
    const gameArea = document.querySelector(".game-area");
    canvas.width = gameArea.offsetWidth;
    canvas.height = gameArea.offsetHeight;

    // 既に魚が描画されていれば再描画する
    if (gameState && gameState.isPlaying) {
      drawWaterPattern();
      drawFish();
    }
  }

  // 初期画面サイズの設定
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // 音声効果 - 空のダミー関数を用意
  let dummySound = {
    play: () => console.log("サウンド再生（ダミー）"),
  };

  // 音声効果を初期化
  let sounds = {
    catch: dummySound,
    splash: dummySound,
    start: dummySound,
    gameover: dummySound,
    poiBreak: dummySound,
    timeWarning: dummySound,
  };

  // サウンドの読み込みを試みる
  try {
    if (typeof Howl !== "undefined") {
      sounds = {
        catch: new Howl({
          src: ["assets/sounds/catch.mp3"],
          volume: 0.5,
        }),
        splash: new Howl({
          src: ["assets/sounds/splash.mp3"],
          volume: 0.5,
        }),
        start: new Howl({
          src: ["assets/sounds/start.mp3"],
          volume: 0.5,
        }),
        gameover: new Howl({
          src: ["assets/sounds/gameover.mp3"],
          volume: 0.5,
        }),
        poiBreak: new Howl({
          src: ["assets/sounds/poi_break.mp3"],
          volume: 0.5,
        }),
        timeWarning: new Howl({
          src: ["assets/sounds/time_warning.mp3"],
          volume: 0.5,
        }),
      };
      console.log("サウンド初期化成功");
    } else {
      console.warn("Howlライブラリが見つかりません");
    }
  } catch (err) {
    console.error("サウンド初期化エラー:", err);
  }

  // 魚の種類の定義
  const fishTypes = [
    {
      color: "red",
      speed: 2,
      size: 30,
      points: 10,
      probability: 0.5,
      image: "assets/fish1.svg",
    },
    {
      color: "gold",
      speed: 3,
      size: 25,
      points: 20,
      probability: 0.3,
      image: "assets/fish2.svg",
    },
    {
      color: "blue",
      speed: 4,
      size: 20,
      points: 30,
      probability: 0.15,
      image: "assets/fish3.svg",
    },
    {
      color: "black",
      speed: 5,
      size: 35,
      points: 50,
      probability: 0.05,
      image: "assets/fish4.svg",
    },
  ];

  // 魚の画像を事前に読み込む
  const fishImages = {};

  function preloadFishImages() {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const totalImages = fishTypes.length;

      fishTypes.forEach((type) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          console.log(
            `魚の画像を読み込み完了: ${type.image} (${loadedCount}/${totalImages})`
          );
          if (loadedCount === totalImages) {
            resolve();
          }
        };
        img.src = type.image;
        fishImages[type.image] = img;
      });

      // 全ての画像が読み込まれるのを5秒以上待たない
      setTimeout(resolve, 5000);
    });
  }

  // タッチイベントの設定
  function setupTouchEvents() {
    // デバイスピクセル比率の取得
    gameState.devicePixelRatio = window.devicePixelRatio || 1;

    // マウスイベント（デスクトップ用）
    canvas.addEventListener("mousedown", (e) => {
      if (!gameState.isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.clientX - rect.left, e.clientY - rect.top);
      poiContainer.style.display = "block";
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!e.buttons || !gameState.isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener("mouseup", (e) => {
      if (!gameState.isPlaying) return;
      const rect = canvas.getBoundingClientRect();
      catchFish(e.clientX - rect.left, e.clientY - rect.top);
      poiContainer.style.display = "none";
      createSplash(e.clientX - rect.left, e.clientY - rect.top);
    });

    // タッチイベント（モバイル用）
    canvas.addEventListener("touchstart", (e) => {
      if (!gameState.isPlaying) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      updatePoiPosition(touch.clientX - rect.left, touch.clientY - rect.top);
      poiContainer.style.display = "block";
    });

    canvas.addEventListener("touchmove", (e) => {
      if (!gameState.isPlaying) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      updatePoiPosition(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener("touchend", (e) => {
      if (!gameState.isPlaying) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      catchFish(gameState.lastTouchX, gameState.lastTouchY);
      poiContainer.style.display = "none";
      createSplash(gameState.lastTouchX, gameState.lastTouchY);
    });

    // スクリーン向きの変更を監視
    window.addEventListener("orientationchange", () => {
      setTimeout(resizeCanvas, 300); // 向き変更後に少し遅延させてサイズを調整
    });

    console.log("マウスイベント設定完了");
  }

  // ポイの位置を更新
  function updatePoiPosition(x, y) {
    poiContainer.style.left = `${x - 40}px`;
    poiContainer.style.top = `${y - 40}px`;
    gameState.lastTouchX = x;
    gameState.lastTouchY = y;
  }

  // 魚をすくう
  function catchFish(x, y) {
    try {
      sounds.splash.play();
    } catch (e) {
      console.error("サウンド再生エラー:", e);
    }

    // アニメーション効果
    poiElement.classList.add("poi-catch");
    setTimeout(() => {
      poiElement.classList.remove("poi-catch");
    }, 200);

    // 魚を捕まえたかチェック
    let caught = false;
    gameState.fish.forEach((fish, index) => {
      const distance = Math.sqrt(
        Math.pow(fish.x - x, 2) + Math.pow(fish.y - y, 2)
      );

      // 捕獲判定の調整（より捕まえやすくする）
      const catchRadius = window.innerWidth <= 480 ? 60 : 50;

      if (distance < catchRadius) {
        // ポイのサイズと魚のサイズを考慮した捕獲範囲
        caught = true;
        // スコア加算
        const pointsGained = fish.points;
        gameState.score += pointsGained;
        scoreElement.textContent = gameState.score;

        // スコアアップのエフェクト
        scoreElement.classList.add("score-bump");
        setTimeout(() => {
          scoreElement.classList.remove("score-bump");
        }, 300);

        // 魚を削除
        gameState.fish.splice(index, 1);

        // 効果音
        try {
          sounds.catch.play();
        } catch (e) {
          console.error("サウンド再生エラー:", e);
        }

        // 魚を捕まえたら新しい魚を追加
        createFish();
      }
    });

    return caught;
  }

  // 水しぶきエフェクトの作成
  function createSplash(x, y) {
    // 水しぶきの円
    const splash = document.createElement("div");
    splash.className = "splash";
    splash.style.left = `${x}px`;
    splash.style.top = `${y}px`;
    splash.style.width = "20px";
    splash.style.height = "20px";
    splash.style.backgroundColor = "rgba(255, 255, 255, 0.6)";

    splashContainer.appendChild(splash);

    // 波紋エフェクト
    const ripple = document.createElement("div");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    splashContainer.appendChild(ripple);

    // アニメーション終了後に要素を削除
    setTimeout(() => {
      splash.remove();
      ripple.remove();
    }, 600);
  }

  // 金魚を生成
  function createFish() {
    // 現在の魚の数が多すぎないか確認
    if (gameState.fish.length >= 15) return;

    // 魚の種類をランダムに選択
    let random = Math.random();
    let selectedFishType = fishTypes[0]; // デフォルトは赤い金魚

    let probabilitySum = 0;
    for (let type of fishTypes) {
      probabilitySum += type.probability;
      if (random <= probabilitySum) {
        selectedFishType = type;
        break;
      }
    }

    // スマホ画面サイズに合わせた設定
    const isMobile = window.innerWidth <= 480;
    const adjustedSize = isMobile
      ? selectedFishType.size * 0.9
      : selectedFishType.size;
    const adjustedSpeed = isMobile
      ? selectedFishType.speed * 1.1
      : selectedFishType.speed;

    // 魚の開始位置と方向をより自然に設定
    let x, y;
    let directionX, directionY;

    // 開始位置をランダムに決定（画面外または端から）
    const entryType = Math.random();

    if (entryType < 0.6) {
      // 60%の確率で左右の端から
      x = Math.random() > 0.5 ? -adjustedSize : canvas.width + adjustedSize;
      y = Math.random() * (canvas.height - 2 * adjustedSize) + adjustedSize;
      // 画面中央に向かう方向
      directionX =
        x < 0 ? 0.8 + Math.random() * 0.2 : -0.8 - Math.random() * 0.2;
      directionY = (canvas.height / 2 - y) / canvas.height;
    } else if (entryType < 0.9) {
      // 30%の確率で上下の端から
      x = Math.random() * (canvas.width - 2 * adjustedSize) + adjustedSize;
      y = Math.random() > 0.5 ? -adjustedSize : canvas.height + adjustedSize;
      // 画面中央に向かう方向
      directionX = (canvas.width / 2 - x) / canvas.width;
      directionY =
        y < 0 ? 0.8 + Math.random() * 0.2 : -0.8 - Math.random() * 0.2;
    } else {
      // 10%の確率で画面中の何処かに出現（すでに水槽内にいる魚）
      x = Math.random() * (canvas.width - 2 * adjustedSize) + adjustedSize;
      y = Math.random() * (canvas.height - 2 * adjustedSize) + adjustedSize;
      // ランダムな方向
      directionX = Math.random() * 2 - 1;
      directionY = Math.random() * 2 - 1;
    }

    // 方向ベクトルの正規化
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length > 0) {
      directionX /= length;
      directionY /= length;
    }

    // 魚オブジェクトの作成（自然な動きのパラメータを追加）
    const fish = {
      x,
      y,
      size: adjustedSize,
      speed: adjustedSpeed,
      directionX,
      directionY,
      color: selectedFishType.color,
      points: selectedFishType.points,
      rotation: Math.atan2(directionY, directionX),
      image: selectedFishType.image,
      imageObj: fishImages[selectedFishType.image],
      // 魚の自然な動きのためのパラメータ
      wiggleOffset: Math.random() * Math.PI * 2, // ランダムなオフセット
      wiggleSpeed: 0.05 + Math.random() * 0.05, // ランダムな揺れの速度
      wiggleAmount: 0.3 + Math.random() * 0.3, // ランダムな揺れの量
      acceleration: 0, // 加速度
      maxSpeed: adjustedSpeed * 1.5, // 最大速度
      minSpeed: adjustedSpeed * 0.7, // 最小速度
      speedChangeInterval: 60 + Math.floor(Math.random() * 120), // 速度変更間隔
      frameCount: Math.floor(Math.random() * 100), // 初期フレームカウントをランダムに
      targetX: null, // 目標x座標（初期はnull）
      targetY: null, // 目標y座標（初期はnull）
      targetForce: 0.01 + Math.random() * 0.01, // 目標に向かう力
      // 魚の種類ごとの特性
      personalityType: Math.floor(Math.random() * 3), // 0:穏やか 1:活発 2:変則的
    };

    gameState.fish.push(fish);
  }

  // 魚の更新
  function updateFish() {
    gameState.fish.forEach((fish) => {
      // フレームカウンターを増加
      fish.frameCount++;

      // 一定間隔で速度変更（加速・減速）を行う
      if (fish.frameCount % fish.speedChangeInterval === 0) {
        // -0.05から0.05の間でランダムな加速度を設定
        fish.acceleration = Math.random() * 0.1 - 0.05;
      }

      // 速度を更新（加速度を適用）
      const currentSpeed =
        Math.sqrt(
          fish.directionX * fish.directionX + fish.directionY * fish.directionY
        ) * fish.speed;
      let newSpeed = currentSpeed + fish.acceleration;

      // 速度の上限と下限を設定
      newSpeed = Math.max(fish.minSpeed, Math.min(fish.maxSpeed, newSpeed));

      // 正規化した方向ベクトルに新しい速度を適用
      const length = Math.sqrt(
        fish.directionX * fish.directionX + fish.directionY * fish.directionY
      );
      if (length > 0) {
        fish.directionX = (fish.directionX / length) * (newSpeed / fish.speed);
        fish.directionY = (fish.directionY / length) * (newSpeed / fish.speed);
      }

      // 目標点に向かって泳ぐ行動を追加（魚が自然に水槽内を泳ぐように）
      if (fish.frameCount % 180 === 0 || !fish.targetX) {
        // 新しい目標点を設定
        fish.targetX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
        fish.targetY =
          Math.random() * canvas.height * 0.8 + canvas.height * 0.1;
        // 目標に向かうための力の強さをランダムに設定
        fish.targetForce = 0.01 + Math.random() * 0.02;
      }

      // 目標点への方向ベクトルを計算
      const toTargetX = fish.targetX - fish.x;
      const toTargetY = fish.targetY - fish.y;
      const targetDist = Math.sqrt(
        toTargetX * toTargetX + toTargetY * toTargetY
      );

      if (targetDist > 5) {
        // 目標点が近すぎない場合だけ方向調整
        // 目標への方向と現在の方向を混ぜる（徐々に方向転換）
        fish.directionX += (toTargetX / targetDist) * fish.targetForce;
        fish.directionY += (toTargetY / targetDist) * fish.targetForce;

        // 方向ベクトルを再度正規化
        const newLength = Math.sqrt(
          fish.directionX * fish.directionX + fish.directionY * fish.directionY
        );
        if (newLength > 0) {
          fish.directionX = fish.directionX / newLength;
          fish.directionY = fish.directionY / newLength;
        }
      }

      // 揺れる動きの計算（より自然な揺れを実現）
      const wiggle =
        Math.sin(fish.frameCount * fish.wiggleSpeed + fish.wiggleOffset) *
        fish.wiggleAmount;

      // 魚の種類に応じて特別な動き（例：金魚は上下に揺れやすい）
      let specialMove = 0;
      if (fish.color === "red" || fish.color === "gold") {
        // 赤や金色の魚（金魚）は上下に揺れやすい
        specialMove = Math.sin(fish.frameCount * 0.02) * 0.2;
        fish.directionY += specialMove;
      } else if (fish.color === "blue") {
        // 青い魚は滑らかな動き
        specialMove = Math.cos(fish.frameCount * 0.03) * 0.15;
        fish.directionX += specialMove;
      } else if (fish.color === "black") {
        // 黒い魚はジグザグ動き
        specialMove = Math.sin(fish.frameCount * 0.08) * 0.25;
        if (fish.frameCount % 30 < 15) {
          fish.directionX += specialMove;
        } else {
          fish.directionY += specialMove;
        }
      }

      // 方向ベクトルを再度正規化
      const dirLength = Math.sqrt(
        fish.directionX * fish.directionX + fish.directionY * fish.directionY
      );
      if (dirLength > 0) {
        fish.directionX = fish.directionX / dirLength;
        fish.directionY = fish.directionY / dirLength;
      }

      // 魚の向きを計算（ベースの方向 + 揺れ）
      const baseAngle = Math.atan2(fish.directionY, fish.directionX);
      fish.rotation = baseAngle + wiggle;

      // 実際の移動方向を計算（揺れを含める）
      const moveAngle = baseAngle + wiggle * 0.3; // 揺れの影響を抑える
      const effectiveSpeed = fish.speed;
      const moveX = Math.cos(moveAngle) * effectiveSpeed;
      const moveY = Math.sin(moveAngle) * effectiveSpeed;

      // 魚の移動
      fish.x += moveX;
      fish.y += moveY;

      // キャンバスの端に到達したら滑らかに方向を変える
      const margin = fish.size;
      if (fish.x <= margin || fish.x >= canvas.width - margin) {
        // x方向の反転（徐々に）
        fish.directionX *= -0.2; // 急な反転ではなく徐々に

        // ランダムなy方向の変化を加える
        fish.directionY += Math.random() * 0.4 - 0.2;

        // 位置の調整（キャンバス内に戻す）
        if (fish.x < margin) fish.x = margin;
        if (fish.x > canvas.width - margin) fish.x = canvas.width - margin;
      }

      if (fish.y <= margin || fish.y >= canvas.height - margin) {
        // y方向の反転（徐々に）
        fish.directionY *= -0.2; // 急な反転ではなく徐々に

        // ランダムなx方向の変化を加える
        fish.directionX += Math.random() * 0.4 - 0.2;

        // 位置の調整（キャンバス内に戻す）
        if (fish.y < margin) fish.y = margin;
        if (fish.y > canvas.height - margin) fish.y = canvas.height - margin;
      }

      // 方向ベクトルの正規化（一定の長さに保つ）
      const finalLength = Math.sqrt(
        fish.directionX * fish.directionX + fish.directionY * fish.directionY
      );
      if (finalLength > 0) {
        fish.directionX = fish.directionX / finalLength;
        fish.directionY = fish.directionY / finalLength;
      }
    });

    // 一定の確率で新しい魚を追加
    if (Math.random() < 0.02 && gameState.fish.length < 15) {
      createFish();
    }
  }

  // 魚の描画
  function drawFish() {
    gameState.fish.forEach((fish) => {
      ctx.save();
      ctx.translate(fish.x, fish.y);

      // 魚の進行方向を計算（directionXが負の場合は左向き）
      const facingLeft = fish.directionX < 0;

      // 進行方向に応じて回転角度を計算
      if (facingLeft) {
        // 左向きの場合、魚の向きを反転させるために追加で180度回転
        ctx.rotate(fish.rotation + Math.PI);
      } else {
        ctx.rotate(fish.rotation);
      }

      // SVG画像を使用して描画
      if (fish.imageObj && fish.imageObj.complete) {
        // 魚のサイズに合わせてスケーリング（中心を基準に）
        const width = fish.size * 3; // サイズを大きくして詳細を見やすく
        const height = fish.size * 1.5;
        ctx.drawImage(fish.imageObj, -width / 2, -height / 2, width, height);
      } else {
        // 画像が読み込まれていない場合のフォールバック
        ctx.fillStyle = fish.color || "#ff6666";
        ctx.beginPath();
        ctx.ellipse(0, 0, fish.size / 2, fish.size / 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 尾びれ（進行方向の逆側に描画）
        ctx.beginPath();
        ctx.moveTo(-fish.size / 2, 0);
        ctx.lineTo(-fish.size, fish.size / 4);
        ctx.lineTo(-fish.size, -fish.size / 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });
  }

  // 水の背景描画
  function drawWaterPattern() {
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 青い背景
    ctx.fillStyle = "#5ea6df";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 水の波紋パターン
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 5; i++) {
      const radius = 50 + i * 40;
      const offset = (Date.now() / 1000) % 5;

      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        radius + offset * 20,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();

    // 水面の光の反射
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = 5 + Math.random() * 20;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.restore();
  }

  // ゲームループ
  function gameLoop() {
    if (!gameState.isPlaying) return;

    // 背景と魚の描画
    drawWaterPattern();
    updateFish();
    drawFish();

    // 次のフレームのアニメーション
    requestAnimationFrame(gameLoop);
  }

  // タイマーの更新
  function updateTimer() {
    gameState.timeRemaining--;
    timerElement.textContent = gameState.timeRemaining;

    // 残り時間10秒以下でタイマーの色を変更
    if (gameState.timeRemaining <= 10 && !gameState.isTimeWarning) {
      gameState.isTimeWarning = true;
      timerElement.parentElement.classList.add("time-warning");
    }

    if (gameState.timeRemaining <= 0) {
      endGame();
    }
  }

  // ゲーム開始
  function startGame() {
    console.log("ゲーム開始関数が呼ばれました");

    // すでに実行中なら何もしない
    if (gameState.isPlaying) {
      console.log("すでにゲーム実行中");
      return;
    }

    // 初期化
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.timeRemaining = 60;
    gameState.isTimeWarning = false;
    gameState.fish = [];

    // 表示の更新
    scoreElement.textContent = "0";
    timerElement.textContent = "60";
    timerElement.parentElement.classList.remove("time-warning");

    // ゲームオーバー画面を非表示
    gameOverScreen.classList.add("hidden");

    // ポイのリセット
    poiElement.src = "assets/poi.svg";
    poiElement.style.opacity = 1;

    // スタートボタンを非表示
    startButton.style.display = "none";

    // 説明テキストを非表示
    document.querySelector(".instructions").style.display = "none";

    console.log("初期魚を生成します");
    // 初期の魚を生成
    for (let i = 0; i < 5; i++) {
      createFish();
    }
    console.log(`生成された魚の数: ${gameState.fish.length}`);

    // タイマーの開始
    console.log("タイマーを開始します");
    gameState.timeInterval = setInterval(updateTimer, 1000);

    // ゲームループの開始
    console.log("ゲームループを開始します");
    requestAnimationFrame(gameLoop);
  }

  // ゲーム終了
  function endGame() {
    // ゲーム状態の更新
    gameState.isPlaying = false;
    clearInterval(gameState.timeInterval);

    // 効果音
    try {
      sounds.gameover.play();
    } catch (e) {
      console.error("サウンド再生エラー:", e);
    }

    // 最終スコアの表示
    finalScoreElement.textContent = gameState.score;

    // アニメーションクラスの初期化
    const gameOverContent = document.querySelector(".game-over-content");
    gameOverContent.classList.remove("animate__zoomIn");
    void gameOverContent.offsetWidth; // リフロー（アニメーションリセット）
    gameOverContent.classList.add("animate__zoomIn");

    // ゲームオーバー画面の表示
    gameOverScreen.classList.remove("hidden");

    // スタートボタンを再表示
    startButton.style.display = "block";
    document.querySelector(".instructions").style.display = "block";
  }

  // 結果共有
  function shareScore() {
    if (navigator.share) {
      navigator
        .share({
          title: "金魚すくいゲーム",
          text: `金魚すくいゲームで${gameState.score}点獲得しました！あなたも挑戦してみてください！`,
          url: window.location.href,
        })
        .catch((error) => console.log("共有に失敗しました", error));
    } else {
      // Web Share APIに対応していない場合
      const text = `金魚すくいゲームで${gameState.score}点獲得しました！あなたも挑戦してみてください！ ${window.location.href}`;
      alert("結果をシェアする機能は現在利用できません。");
    }
  }

  // イベントリスナーのセットアップ
  function setupEventListeners() {
    console.log("イベントリスナーを設定します");

    // スタートボタンとリスタートボタンにクリックイベントを追加
    if (startButton) {
      startButton.addEventListener("click", function () {
        console.log("スタートボタンがクリックされました");
        startGame();
      });
      console.log("スタートボタンのイベントリスナーを設定しました");
    }

    if (restartButton) {
      restartButton.addEventListener("click", function () {
        console.log("リスタートボタンがクリックされました");
        startGame();
      });
      console.log("リスタートボタンのイベントリスナーを設定しました");
    }

    if (shareButton) {
      shareButton.addEventListener("click", shareScore);
      console.log("シェアボタンのイベントリスナーを設定しました");
    }

    // モバイルデバイスの向き変更検出
    window.addEventListener("orientationchange", () => {
      const orientationMessage = document.getElementById("orientation-message");

      if (orientationMessage) {
        if (window.orientation === 90 || window.orientation === -90) {
          // 横向き
          orientationMessage.style.display = "flex";
        } else {
          // 縦向き
          orientationMessage.style.display = "none";
        }
      }
    });

    // ページビジビリティの変更を検出（バックグラウンドになった時にポーズ）
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && gameState.isPlaying) {
        // 一時停止の処理
        clearInterval(gameState.timeInterval);
      } else if (!document.hidden && gameState.isPlaying) {
        // 再開の処理
        gameState.timeInterval = setInterval(updateTimer, 1000);
      }
    });
    console.log("イベントリスナー設定完了");
  }

  // 初期化
  function init() {
    console.log("初期化開始");

    setupTouchEvents();
    setupEventListeners();

    // 魚の画像を事前に読み込む
    preloadFishImages().then(() => {
      console.log("魚の画像読み込み完了");

      // ゲーム画面の初期描画
      drawWaterPattern();

      // テスト用に1匹の魚を表示
      if (!gameState.isPlaying) {
        createFish();
        drawFish();
      }
    });

    // モバイルデバイスの向きチェック
    if (window.orientation !== undefined) {
      if (window.orientation === 90 || window.orientation === -90) {
        const orientationMessage = document.getElementById(
          "orientation-message"
        );
        if (orientationMessage) {
          orientationMessage.style.display = "flex";
        }
      }
    }

    // iPhoneなどでのスクロールを防止
    document.body.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
    console.log("初期化完了");
  }

  // ゲームの初期化
  init();
  console.log(
    "ゲームの初期化が完了しました。スタートボタンをクリックして開始できます。"
  );
});
