document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM読み込み完了");
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

  // 手動でスタートボタンにクリックイベントを追加（直接バインド）
  if (startButton) {
    startButton.onclick = function () {
      console.log("スタートボタン直接クリック");
      startGame();
    };
    console.log("スタートボタンへの直接イベント設定完了");
  }

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
    isTimeWarning: false,
    devicePixelRatio: window.devicePixelRatio || 1,
  };

  // タッチイベントの設定
  function setupTouchEvents() {
    // デバイスピクセル比率の取得
    gameState.devicePixelRatio = window.devicePixelRatio || 1;

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

    // タッチイベント（モバイル用）
    canvas.addEventListener("touchstart", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      updatePoiPosition(touch.clientX - rect.left, touch.clientY - rect.top);
      poiContainer.style.display = "block";
    });

    canvas.addEventListener("touchmove", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      updatePoiPosition(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener("touchend", (e) => {
      if (!gameState.isPlaying || gameState.poiBroken) return;
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
    if (gameState.poiBroken) return;

    try {
      sounds.splash.play();
    } catch (e) {
      console.error("サウンド再生エラー:", e);
    }

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

      // 捕獲判定の調整（モバイル端末では少し捕まえやすくする）
      const catchRadius = window.innerWidth <= 480 ? 45 : 40;

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

  // ポイが壊れる
  function breakPoi() {
    gameState.poiBroken = true;
    try {
      sounds.poiBreak.play();
    } catch (e) {
      console.error("サウンド再生エラー:", e);
    }

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

    // 魚の開始位置（キャンバスの端からランダム）
    const startFromSide = Math.random() > 0.5;
    let x, y;
    let directionX, directionY;

    if (startFromSide) {
      // 左右のいずれかから開始
      x = Math.random() > 0.5 ? 0 : canvas.width;
      y = Math.random() * canvas.height;
      directionX = x === 0 ? 1 : -1;
      directionY = Math.random() * 2 - 1;
    } else {
      // 上下のいずれかから開始
      x = Math.random() * canvas.width;
      y = Math.random() > 0.5 ? 0 : canvas.height;
      directionX = Math.random() * 2 - 1;
      directionY = y === 0 ? 1 : -1;
    }

    // 魚オブジェクトの作成
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
      useDefaultColor: true, // 常にデフォルトカラーを使用
    };

    gameState.fish.push(fish);
  }

  // 魚の更新
  function updateFish() {
    gameState.fish.forEach((fish) => {
      // 魚の移動
      fish.x += fish.directionX * fish.speed;
      fish.y += fish.directionY * fish.speed;

      // キャンバスの端に到達したら向きを変える
      if (fish.x <= 0 || fish.x >= canvas.width) {
        fish.directionX *= -1;
      }
      if (fish.y <= 0 || fish.y >= canvas.height) {
        fish.directionY *= -1;
      }

      // 回転角度の更新
      fish.rotation = Math.atan2(fish.directionY, fish.directionX);
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
      ctx.rotate(fish.rotation);

      // 単色で描画
      ctx.fillStyle = fish.color || "#ff6666";
      ctx.beginPath();
      ctx.ellipse(0, 0, fish.size / 2, fish.size / 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 尾びれ
      ctx.beginPath();
      ctx.moveTo(fish.size / 2, 0);
      ctx.lineTo(fish.size, fish.size / 4);
      ctx.lineTo(fish.size, -fish.size / 4);
      ctx.closePath();
      ctx.fill();

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
    gameState.poiCatchAttempts = 0;
    gameState.poiBroken = false;
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
  function shareResult() {
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

  // イベントリスナーの設定
  function setupEventListeners() {
    console.log("イベントリスナー設定開始");

    // 以前のリスナーをすべて削除
    startButton.removeEventListener("click", startGame);

    // 新しいリスナーを設定
    startButton.addEventListener("click", function () {
      console.log("スタートボタンがクリックされました");
      startGame();
    });

    restartButton.addEventListener("click", function () {
      console.log("リスタートボタンがクリックされました");
      startGame();
    });

    if (shareButton) {
      shareButton.addEventListener("click", shareResult);
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

    // スタートボタンへの直接イベント設定
    startButton.onclick = startGame;
    console.log("スタートボタンへ onclick で直接設定");

    setupTouchEvents();
    setupEventListeners();

    // ゲーム画面の初期描画
    drawWaterPattern();

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

  // グローバルにゲーム開始関数を公開
  window.gameStart = startGame;

  // ゲームの初期化
  init();
});
