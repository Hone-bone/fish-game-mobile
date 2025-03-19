document.addEventListener("DOMContentLoaded", () => {
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

  // キャンバスサイズの設定
  function resizeCanvas() {
    const gameArea = document.querySelector(".game-area");
    canvas.width = gameArea.offsetWidth;
    canvas.height = gameArea.offsetHeight;
  }

  // 初期画面サイズの設定
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // 音声効果
  const sounds = {
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
  };

  // ゲーム状態
  let gameState = {
    isPlaying: false,
    score: 0,
    timeRemaining: 60,
    timeInterval: null,
    fish: [],
    lastTouchX: 0,
    lastTouchY: 0,
    poiHealth: 100,
    poiMaxCatchAttempts: 5,
    poiCatchAttempts: 0,
    poiBroken: false,
  };

  // タッチイベントの設定
  function setupTouchEvents() {
    // Hammer.jsでタッチ操作を設定
    const hammer = new Hammer(canvas);
    hammer.get("pan").set({ direction: Hammer.DIRECTION_ALL });

    hammer.on("panstart", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.center.x - rect.left, e.center.y - rect.top);
      poiContainer.style.display = "block";
    });

    hammer.on("panmove", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.center.x - rect.left, e.center.y - rect.top);
    });

    hammer.on("panend", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      catchFish(e.center.x - rect.left, e.center.y - rect.top);
      poiContainer.style.display = "none";
      createSplash(e.center.x - rect.left, e.center.y - rect.top);
    });

    hammer.on("tap", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.center.x - rect.left, e.center.y - rect.top);
      poiContainer.style.display = "block";
      setTimeout(() => {
        catchFish(e.center.x - rect.left, e.center.y - rect.top);
        poiContainer.style.display = "none";
        createSplash(e.center.x - rect.left, e.center.y - rect.top);
      }, 100);
    });

    // マウスイベント（デスクトップ用）
    canvas.addEventListener("mousedown", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.clientX - rect.left, e.clientY - rect.top);
      poiContainer.style.display = "block";
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!e.buttons || !gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      updatePoiPosition(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener("mouseup", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      const rect = canvas.getBoundingClientRect();
      catchFish(e.clientX - rect.left, e.clientY - rect.top);
      poiContainer.style.display = "none";
      createSplash(e.clientX - rect.left, e.clientY - rect.top);
    });
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
    if (gameState.poiBroken) return;

    sounds.splash.play();

    // ポイの使用回数を増やす
    gameState.poiCatchAttempts++;

    // ポイが壊れたかどうかをチェック
    if (gameState.poiCatchAttempts >= gameState.poiMaxCatchAttempts) {
      breakPoi();
      return;
    }

    // ポイのダメージを表示（色を薄くする）
    const damage = gameState.poiCatchAttempts / gameState.poiMaxCatchAttempts;
    poiElement.style.opacity = 1 - damage * 0.7;

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

      if (distance < 40) {
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
        sounds.catch.play();
      }
    });

    return caught;
  }

  // ポイが壊れる
  function breakPoi() {
    gameState.poiBroken = true;
    sounds.poiBreak.play();

    // 壊れたポイの画像に変更
    poiElement.src = "assets/broken-poi.svg";
    poiElement.style.opacity = 1;

    // 一時的にポイを表示して壊れたことを示す
    poiContainer.style.display = "block";
    setTimeout(() => {
      poiContainer.style.display = "none";

      // 3秒後に新しいポイを用意
      setTimeout(() => {
        gameState.poiBroken = false;
        gameState.poiCatchAttempts = 0;
        poiElement.src = "assets/poi.svg";
        poiElement.style.opacity = 1;
      }, 3000);
    }, 1000);
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
    const fishTypes = [
      {
        color: "red",
        speed: 2,
        points: 10,
        size: 30,
        image: "assets/fish1.svg",
      },
      {
        color: "orange",
        speed: 3,
        points: 20,
        size: 25,
        image: "assets/fish2.svg",
      },
      {
        color: "white",
        speed: 4,
        points: 30,
        size: 20,
        image: "assets/fish3.svg",
      },
      {
        color: "gold",
        speed: 5,
        points: 50,
        size: 15,
        image: "assets/fish4.svg",
      },
    ];

    // ランダムな魚のタイプを選択
    const fishType = fishTypes[Math.floor(Math.random() * fishTypes.length)];

    // 魚の初期位置（画面外から入ってくる）
    const side = Math.floor(Math.random() * 4); // 0: 上, 1: 右, 2: 下, 3: 左
    let x, y, angle;

    switch (side) {
      case 0: // 上
        x = Math.random() * canvas.width;
        y = -fishType.size;
        angle = Math.PI * 0.5 + (Math.random() * 0.5 - 0.25);
        break;
      case 1: // 右
        x = canvas.width + fishType.size;
        y = Math.random() * canvas.height;
        angle = Math.PI + (Math.random() * 0.5 - 0.25);
        break;
      case 2: // 下
        x = Math.random() * canvas.width;
        y = canvas.height + fishType.size;
        angle = Math.PI * 1.5 + (Math.random() * 0.5 - 0.25);
        break;
      case 3: // 左
        x = -fishType.size;
        y = Math.random() * canvas.height;
        angle = 0 + (Math.random() * 0.5 - 0.25);
        break;
    }

    // 魚オブジェクトを作成
    const fish = {
      ...fishType,
      x,
      y,
      angle,
      // 泳ぎをより自然にするための細かいパラメータ
      wiggle: 0,
      wiggleSpeed: 0.1 + Math.random() * 0.1,
      wiggleAmount: 0.2 + Math.random() * 0.2,
      // 方向転換のパラメータ
      turnChance: 0.01,
      turnAmount: 0.5,
    };

    // 魚を配列に追加
    gameState.fish.push(fish);
  }

  // 金魚の更新
  function updateFish() {
    gameState.fish.forEach((fish, index) => {
      // 魚の位置を更新
      if (Math.random() < fish.turnChance) {
        fish.angle += (Math.random() * 2 - 1) * fish.turnAmount;
      }

      // ウィグル（魚の泳ぎをより自然に）
      fish.wiggle += fish.wiggleSpeed;
      const wiggleAngle = Math.sin(fish.wiggle) * fish.wiggleAmount;

      // 魚の移動
      fish.x += Math.cos(fish.angle + wiggleAngle) * fish.speed;
      fish.y += Math.sin(fish.angle + wiggleAngle) * fish.speed;

      // 画面外に出た魚を削除
      if (
        fish.x < -50 ||
        fish.x > canvas.width + 50 ||
        fish.y < -50 ||
        fish.y > canvas.height + 50
      ) {
        gameState.fish.splice(index, 1);
      }
    });
  }

  // 魚の描画
  function drawFish() {
    gameState.fish.forEach((fish) => {
      ctx.save();

      // 魚の位置に移動して回転
      ctx.translate(fish.x, fish.y);
      ctx.rotate(fish.angle + Math.PI * 0.5);

      // 魚の画像があればそれを使用
      const fishImage = new Image();
      fishImage.src = fish.image;
      ctx.drawImage(
        fishImage,
        -fish.size / 2,
        -fish.size / 2,
        fish.size,
        fish.size
      );

      ctx.restore();
    });
  }

  // 水面のパターン描画
  function drawWaterPattern() {
    // 水の背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#5ea6df");
    gradient.addColorStop(1, "#4a86e8");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 水面の波紋パターン
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;

    const time = Date.now() * 0.001;
    const waveCount = 5;
    const waveSpacing = canvas.height / waveCount;

    for (let i = 0; i < waveCount; i++) {
      ctx.beginPath();

      for (let x = 0; x <= canvas.width; x += 20) {
        const y = i * waveSpacing + Math.sin(x * 0.03 + time + i) * 5;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  }

  // ゲームループ
  function gameLoop() {
    if (!gameState.isPlaying) return;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 水面のパターンを描画
    drawWaterPattern();

    // 魚をランダムに生成
    if (Math.random() < 0.05 && gameState.fish.length < 15) {
      createFish();
    }

    // 魚の更新と描画
    updateFish();
    drawFish();

    // 次のフレームを要求
    requestAnimationFrame(gameLoop);
  }

  // タイマーの更新
  function updateTimer() {
    gameState.timeRemaining--;
    timerElement.textContent = gameState.timeRemaining;

    if (gameState.timeRemaining <= 0) {
      endGame();
    }
  }

  // ゲーム開始
  function startGame() {
    // ゲーム状態のリセット
    gameState = {
      isPlaying: true,
      score: 0,
      timeRemaining: 60,
      timeInterval: null,
      fish: [],
      lastTouchX: 0,
      lastTouchY: 0,
      poiHealth: 100,
      poiMaxCatchAttempts: 5,
      poiCatchAttempts: 0,
      poiBroken: false,
    };

    // UI更新
    scoreElement.textContent = "0";
    timerElement.textContent = "60";
    gameOverScreen.classList.add("hidden");
    startButton.style.display = "none";
    poiElement.src = "assets/poi.svg";
    poiElement.style.opacity = 1;

    // ゲームループとタイマーの開始
    gameLoop();
    gameState.timeInterval = setInterval(updateTimer, 1000);

    // 開始音
    sounds.start.play();
  }

  // ゲーム終了
  function endGame() {
    gameState.isPlaying = false;
    clearInterval(gameState.timeInterval);

    // 終了音
    sounds.gameover.play();

    // スコア表示
    finalScoreElement.textContent = gameState.score;

    // ゲームオーバー画面表示
    gameOverScreen.classList.remove("hidden");
    gameOverScreen
      .querySelector(".game-over-content")
      .classList.add("animate__bounceIn");

    // スタートボタンの表示
    startButton.style.display = "block";
  }

  // 結果共有
  function shareResult() {
    const text = `金魚すくいゲームで${gameState.score}点獲得しました！あなたも挑戦してみませんか？`;

    if (navigator.share) {
      navigator
        .share({
          title: "金魚すくいゲーム",
          text: text,
          url: document.location.href,
        })
        .catch((error) => console.log("シェアに失敗しました", error));
    } else {
      // フォールバック：テキストをクリップボードにコピー
      navigator.clipboard
        .writeText(text)
        .then(() => {
          alert("結果をクリップボードにコピーしました！");
        })
        .catch((err) => {
          console.error("クリップボードへのコピーに失敗しました", err);
        });
    }
  }

  // イベントリスナー設定
  function setupEventListeners() {
    startButton.addEventListener("click", startGame);
    restartButton.addEventListener("click", startGame);
    shareButton.addEventListener("click", shareResult);

    // iOS Safari でのダブルタップズームを防止
    document.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );

    // ピンチズームを防止
    document.addEventListener(
      "gesturestart",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
  }

  // 初期化
  function init() {
    setupTouchEvents();
    setupEventListeners();

    // iOSのスクロールバウンス防止
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    // 初期の水面パターン描画
    drawWaterPattern();
  }

  // ゲーム初期化
  init();
});
