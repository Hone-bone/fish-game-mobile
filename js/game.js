document.addEventListener("DOMContentLoaded", () => {
  try {
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

    console.log("要素取得完了");

    // キャンバスサイズの設定
    function resizeCanvas() {
      const gameArea = document.querySelector(".game-area");
      canvas.width = gameArea.offsetWidth;
      canvas.height = gameArea.offsetHeight;

      // 既に魚が描画されていれば再描画する
      if (gameState.isPlaying) {
        drawWaterPattern();
        drawFish();
      } else {
        // ゲーム開始前も水槽と魚を描画する
        drawWaterPattern();
        if (gameState.fish.length > 0) {
          drawFish();
        }
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
        size: 24,
        points: 10,
        probability: 0.5,
        image: "assets/fish1.svg",
      },
      {
        color: "gold",
        speed: 3,
        size: 20,
        points: 20,
        probability: 0.3,
        image: "assets/fish2.svg",
      },
      {
        color: "blue",
        speed: 4,
        size: 16,
        points: 30,
        probability: 0.15,
        image: "assets/fish3.svg",
      },
      {
        color: "black",
        speed: 5,
        size: 28,
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

      // スクリーン向きの変更は別のイベントリスナーで処理するため削除

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
      const caughtFishIndices = []; // 捕まえた魚のインデックスを記録

      // 捕獲判定の調整（より捕まえやすくする）
      const isMobile = window.innerWidth <= 480;
      const baseRadius = isMobile ? 56 : 48;

      gameState.fish.forEach((fish, index) => {
        // 魚の中心からの距離を計算
        const distance = Math.sqrt(
          Math.pow(fish.x - x, 2) + Math.pow(fish.y - y, 2)
        );

        // 魚のサイズに応じてキャッチ半径を調整（大きい魚は捕まえやすく）
        const catchRadius = baseRadius * (fish.size / 30);

        // 捕獲判定 - ポイの半径と魚のサイズを考慮
        if (distance < catchRadius) {
          caught = true;
          caughtFishIndices.push(index);

          // スコア加算
          const pointsGained = fish.points;
          gameState.score += pointsGained;
          scoreElement.textContent = gameState.score;

          // スコアアップのエフェクト
          scoreElement.classList.add("score-bump");
          setTimeout(() => {
            scoreElement.classList.remove("score-bump");
          }, 300);

          // 効果音
          try {
            sounds.catch.play();
          } catch (e) {
            console.error("サウンド再生エラー:", e);
          }
        }
      });

      // インデックスの大きい順に魚を削除（小さいインデックスから削除すると後続のインデックスがずれるため）
      caughtFishIndices
        .sort((a, b) => b - a)
        .forEach((index) => {
          gameState.fish.splice(index, 1);
        });

      // 魚を捕まえた場合、新しい魚を追加
      if (caught) {
        // 捕まえた数だけ新しい魚を生成（ただし一度に大量に生成しないよう制限）
        const fishToAdd = Math.min(caughtFishIndices.length, 2);
        for (let i = 0; i < fishToAdd; i++) {
          createFish();
        }
      }

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
      // サイズの調整率を小さくして適切な大きさを維持
      const adjustedSize = selectedFishType.size;
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
        x =
          Math.random() > 0.5
            ? -adjustedSize * 1.2
            : canvas.width + adjustedSize * 1.2;
        y = Math.random() * (canvas.height - 2 * adjustedSize) + adjustedSize;
        // 画面中央に向かう方向（より安定した動きに）
        directionX =
          x < 0 ? 0.7 + Math.random() * 0.2 : -0.7 - Math.random() * 0.2;
        directionY = ((canvas.height / 2 - y) / canvas.height) * 0.5; // 垂直方向の動きを抑制
      } else if (entryType < 0.9) {
        // 30%の確率で上下の端から
        x = Math.random() * (canvas.width - 2 * adjustedSize) + adjustedSize;
        y =
          Math.random() > 0.5
            ? -adjustedSize * 1.2
            : canvas.height + adjustedSize * 1.2;
        // 画面中央に向かう方向（より安定した動きに）
        directionX = ((canvas.width / 2 - x) / canvas.width) * 0.5; // 水平方向の動きを抑制
        directionY =
          y < 0 ? 0.7 + Math.random() * 0.2 : -0.7 - Math.random() * 0.2;
      } else {
        // 10%の確率で画面中の何処かに出現（すでに水槽内にいる魚）- 壁際は避ける
        const safeMargin = adjustedSize * 2;
        x = Math.random() * (canvas.width - safeMargin * 2) + safeMargin;
        y = Math.random() * (canvas.height - safeMargin * 2) + safeMargin;
        // より穏やかなランダムな方向
        directionX = Math.random() * 1.6 - 0.8;
        directionY = Math.random() * 1.6 - 0.8;
      }

      // 方向ベクトルの正規化
      const length = Math.sqrt(
        directionX * directionX + directionY * directionY
      );
      if (length > 0) {
        directionX /= length;
        directionY /= length;
      } else {
        // 万が一方向が0になった場合の対策
        directionX = Math.random() > 0.5 ? 0.7 : -0.7;
        directionY = Math.random() * 0.6 - 0.3;
      }

      // 常に右向き（正のX方向）を初期向きとして設定
      if (directionX < 0) {
        directionX *= -1;
        directionY *= -1;
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
        wiggleSpeed: 0.04 + Math.random() * 0.03, // ランダムな揺れの速度（少し遅めに）
        wiggleAmount: 0.15 + Math.random() * 0.15, // ランダムな揺れの量（少し控えめに）
        acceleration: 0, // 加速度
        maxSpeed: adjustedSpeed * 1.3, // 最大速度（少し控えめに）
        minSpeed: adjustedSpeed * 0.7, // 最小速度
        speedChangeInterval: 90 + Math.floor(Math.random() * 120), // 速度変更間隔（長めに）
        frameCount: Math.floor(Math.random() * 100), // 初期フレームカウントをランダムに
        targetX: null, // 目標x座標（初期はnull）
        targetY: null, // 目標y座標（初期はnull）
        targetForce: 0.005 + Math.random() * 0.005, // 目標に向かう力（弱めに）
        // 魚の種類ごとの特性
        personalityType: Math.floor(Math.random() * 3), // 0:穏やか 1:活発 2:変則的
        facingRight: true, // 常に右向きを初期状態とする
        // スタック検出用
        prevX: x,
        prevY: y,
        stuckFrames: 0,
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
            fish.directionX * fish.directionX +
              fish.directionY * fish.directionY
          ) * fish.speed;
        let newSpeed = currentSpeed + fish.acceleration;

        // 速度の上限と下限を設定
        newSpeed = Math.max(fish.minSpeed, Math.min(fish.maxSpeed, newSpeed));

        // 正規化した方向ベクトルに新しい速度を適用
        const length = Math.sqrt(
          fish.directionX * fish.directionX + fish.directionY * fish.directionY
        );
        if (length > 0) {
          fish.directionX =
            (fish.directionX / length) * (newSpeed / fish.speed);
          fish.directionY =
            (fish.directionY / length) * (newSpeed / fish.speed);
        }

        // 目標点に向かって泳ぐ行動を追加（魚が自然に水槽内を泳ぐように）
        if (fish.frameCount % 180 === 0 || !fish.targetX) {
          // 新しい目標点を設定 - 画面の中央付近に偏らないよう調整
          fish.targetX =
            Math.random() * canvas.width * 0.7 + canvas.width * 0.15;
          fish.targetY =
            Math.random() * canvas.height * 0.7 + canvas.height * 0.15;
          // 目標に向かうための力の強さをランダムに設定
          fish.targetForce = 0.005 + Math.random() * 0.01; // 少し弱めに設定して急な動きを防止
        }

        // 目標点への方向ベクトルを計算
        const toTargetX = fish.targetX - fish.x;
        const toTargetY = fish.targetY - fish.y;
        const targetDist = Math.sqrt(
          toTargetX * toTargetX + toTargetY * toTargetY
        );

        if (targetDist > 5) {
          // 目標点が近すぎない場合だけ方向調整
          // 目標への方向と現在の方向を混ぜる（徐々に方向転換、力を弱めに）
          fish.directionX += (toTargetX / targetDist) * fish.targetForce;
          fish.directionY += (toTargetY / targetDist) * fish.targetForce;

          // 方向ベクトルを再度正規化
          const newLength = Math.sqrt(
            fish.directionX * fish.directionX +
              fish.directionY * fish.directionY
          );
          if (newLength > 0) {
            fish.directionX = fish.directionX / newLength;
            fish.directionY = fish.directionY / newLength;
          }
        }

        // 揺れる動きの計算（揺れ幅を小さくして自然に）
        let frameOffset =
          fish.frameCount * fish.wiggleSpeed + fish.wiggleOffset;
        // 振動が特定の状態で大きくなりすぎないようにする
        const wiggleScale = Math.min(
          0.7,
          Math.abs(Math.sin(frameOffset * 0.1)) + 0.3
        );
        const wiggle =
          Math.sin(frameOffset) * (fish.wiggleAmount * wiggleScale); // 揺れを動的に調整

        // 魚の種類に応じて特別な動き（影響を抑えて安定化）
        let specialMove = 0;
        if (fish.color === "red" || fish.color === "gold") {
          // 赤や金色の魚（金魚）は上下に揺れやすいが、揺れを抑える
          specialMove = Math.sin(fish.frameCount * 0.02) * 0.08;
          fish.directionY += specialMove;
        } else if (fish.color === "blue") {
          // 青い魚は滑らかな動き
          specialMove = Math.cos(fish.frameCount * 0.03) * 0.06;
          fish.directionX += specialMove;
        } else if (fish.color === "black") {
          // 黒い魚はジグザグ動き（揺れを小さくして安定化）
          specialMove = Math.sin(fish.frameCount * 0.04) * 0.1;
          if (fish.frameCount % 30 < 15) {
            fish.directionX += specialMove;
          } else {
            fish.directionY += specialMove;
          }
        }

        // 振動検出 - 高速振動している場合
        if (fish.prevPrevX !== undefined) {
          const currentPattern = Math.sign(fish.x - fish.prevX);
          const prevPattern = Math.sign(fish.prevX - fish.prevPrevX);

          // 前回と今回の移動方向が逆で、かつ移動距離が小さい場合は振動している可能性が高い
          if (
            currentPattern !== 0 &&
            prevPattern !== 0 &&
            currentPattern !== prevPattern &&
            Math.abs(fish.x - fish.prevX) < 1
          ) {
            fish.oscillationCount = (fish.oscillationCount || 0) + 1;

            // 一定回数以上振動が続いたらリセット
            if (fish.oscillationCount > 3) {
              // 方向をランダムに変更し、少し移動させる
              const randomAngle = Math.random() * Math.PI * 2;
              fish.directionX = Math.cos(randomAngle);
              fish.directionY = Math.sin(randomAngle);
              fish.x += fish.directionX * 5; // 少し強制的に移動
              fish.y += fish.directionY * 5;

              // 新しい目標点を設定
              fish.targetX =
                Math.random() * canvas.width * 0.7 + canvas.width * 0.15;
              fish.targetY =
                Math.random() * canvas.height * 0.7 + canvas.height * 0.15;

              fish.oscillationCount = 0;
              fish.stuckFrames = 0;
            }
          } else {
            fish.oscillationCount = 0;
          }
        }

        // 方向ベクトルを再度正規化
        const dirLength = Math.sqrt(
          fish.directionX * fish.directionX + fish.directionY * fish.directionY
        );
        if (dirLength > 0) {
          fish.directionX = fish.directionX / dirLength;
          fish.directionY = fish.directionY / dirLength;
        } else {
          // 方向ベクトルが0になることを防止（スタック防止）
          fish.directionX = Math.random() * 2 - 1;
          fish.directionY = Math.random() * 2 - 1;
          const resetLength = Math.sqrt(
            fish.directionX * fish.directionX +
              fish.directionY * fish.directionY
          );
          if (resetLength > 0) {
            fish.directionX = fish.directionX / resetLength;
            fish.directionY = fish.directionY / resetLength;
          }
        }

        // 魚の向きを計算（ベースの方向 + 揺れ）
        const baseAngle = Math.atan2(fish.directionY, fish.directionX);

        // 魚の向きを保存
        const isFacingRight = fish.directionX >= 0;

        // 魚が後ろ向きに動こうとする場合、向きを反転させる
        if (isFacingRight !== fish.facingRight) {
          // 向きの変更頻度を制限（振動防止）
          if (
            !fish.lastDirectionChange ||
            fish.frameCount - fish.lastDirectionChange > 10
          ) {
            fish.directionX *= -1;
            fish.directionY *= -1;
            fish.facingRight = isFacingRight;
            fish.lastDirectionChange = fish.frameCount;
          }
        }

        // 揺れを適用した回転角度を計算（揺れを小さくして安定化）
        fish.rotation =
          Math.atan2(fish.directionY, fish.directionX) + wiggle * 0.5;

        // 実際の移動方向を計算（揺れを含める - 影響を小さく）
        const moveAngle =
          Math.atan2(fish.directionY, fish.directionX) + wiggle * 0.15;
        const effectiveSpeed = fish.speed;
        let moveX = Math.cos(moveAngle) * effectiveSpeed;
        let moveY = Math.sin(moveAngle) * effectiveSpeed;

        // 前々回の位置を記録
        fish.prevPrevX = fish.prevX;
        fish.prevPrevY = fish.prevY;

        // 前回位置を記録
        fish.prevX = fish.x;
        fish.prevY = fish.y;

        // 魚の移動（常に前進するように）
        fish.x += Math.abs(moveX) * Math.sign(fish.directionX);
        fish.y += moveY;

        // キャンバスの端に到達したら滑らかに方向を変える
        const margin = fish.size;
        if (fish.x <= margin || fish.x >= canvas.width - margin) {
          // x方向の反転（徐々に）- より自然な動きに
          fish.directionX *= -0.5; // より強い反転力を適用
          fish.facingRight = !fish.facingRight; // 向きも反転
          fish.lastDirectionChange = fish.frameCount; // 向き変更タイミングを記録

          // ランダムなy方向の変化を加える（より自然に）
          fish.directionY += Math.random() * 0.3 - 0.15;

          // 位置の調整（キャンバス内に戻す）
          if (fish.x < margin) fish.x = margin + 2; // 余裕を持たせる
          if (fish.x > canvas.width - margin)
            fish.x = canvas.width - margin - 2;
        }

        if (fish.y <= margin || fish.y >= canvas.height - margin) {
          // y方向の反転（徐々に）- より自然な動きに
          fish.directionY *= -0.5; // より強い反転力を適用

          // ランダムなx方向の変化を加える（より自然に）
          fish.directionX += Math.random() * 0.3 - 0.15;

          // 位置の調整（キャンバス内に戻す）
          if (fish.y < margin) fish.y = margin + 2; // 余裕を持たせる
          if (fish.y > canvas.height - margin)
            fish.y = canvas.height - margin - 2;
        }

        // 方向ベクトルを再度正規化（壁での反射後）
        const finalDirLength = Math.sqrt(
          fish.directionX * fish.directionX + fish.directionY * fish.directionY
        );
        if (finalDirLength > 0) {
          fish.directionX = fish.directionX / finalDirLength;
          fish.directionY = fish.directionY / finalDirLength;
        } else {
          // スタック防止のため、方向をランダムに再設定
          fish.directionX = Math.random() > 0.5 ? 0.8 : -0.8;
          fish.directionY = Math.random() * 0.4 - 0.2;
        }

        // 完全に動きが止まるのを防止する（スタック対策）
        if (
          Math.abs(fish.x - fish.prevX) < 0.1 &&
          Math.abs(fish.y - fish.prevY) < 0.1
        ) {
          fish.stuckFrames = (fish.stuckFrames || 0) + 1;

          // 一定フレーム数動かない場合、ランダムな方向に動かす
          if (fish.stuckFrames > 10) {
            // より強制的な移動
            const randomAngle = Math.random() * Math.PI * 2;
            fish.directionX = Math.cos(randomAngle);
            fish.directionY = Math.sin(randomAngle);
            fish.x += fish.directionX * 3; // 少し強制的に移動
            fish.y += fish.directionY * 3;
            fish.targetX = Math.random() * canvas.width;
            fish.targetY = Math.random() * canvas.height;
            fish.stuckFrames = 0;
          }
        } else {
          fish.stuckFrames = 0;
        }
      });

      // 追加: 魚を少しずつ増やす（ゲームが進むにつれて）
      if (Math.random() < 0.01 && gameState.fish.length < 15) {
        createFish();
      }
    }

    // 魚の描画
    function drawFish() {
      gameState.fish.forEach((fish) => {
        // 画面外の魚は描画しない（パフォーマンス向上）
        const margin = fish.size * 3;
        if (
          fish.x < -margin ||
          fish.x > canvas.width + margin ||
          fish.y < -margin ||
          fish.y > canvas.height + margin
        ) {
          return;
        }

        ctx.save();
        ctx.translate(fish.x, fish.y);

        // 魚の進行方向に基づいて回転（回転値が異常な場合の対策）
        if (isNaN(fish.rotation)) {
          fish.rotation = 0; // 回転値が不正な場合はリセット
        }
        ctx.rotate(fish.rotation);

        // SVG画像を使用して描画
        if (fish.imageObj && fish.imageObj.complete) {
          try {
            // 魚のサイズに合わせてスケーリング（中心を基準に）
            // サイズを一定にすることで拡大縮小の問題を解消
            const width = fish.size * 2.5;
            const height = fish.size * 1.25;
            ctx.drawImage(
              fish.imageObj,
              -width / 2,
              -height / 2,
              width,
              height
            );
          } catch (e) {
            // 画像描画エラー時のフォールバック
            console.error("魚の画像描画エラー:", e);
            drawFallbackFish(fish);
          }
        } else {
          // 画像が読み込まれていない場合のフォールバック
          drawFallbackFish(fish);
        }

        ctx.restore();
      });
    }

    // フォールバック用の魚の描画関数
    function drawFallbackFish(fish) {
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

    // 水面のパターン描画
    function drawWaterPattern() {
      // 背景色をクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // グラデーション背景を作成（上部から下部へ）
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#2a5298"); // 上部の色（深い青）
      gradient.addColorStop(0.4, "#3d7edb"); // 中間の色（明るい青）
      gradient.addColorStop(1, "#1e3c72"); // 下部の色（暗い青）

      // 背景を描画
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 現在の時間を取得（アニメーション用）
      const currentTime = Date.now() * 0.001;

      // 光の粒子効果
      ctx.globalAlpha = 0.2;
      const particleCount = 50;

      for (let i = 0; i < particleCount; i++) {
        // 粒子のサイズと位置をランダムに決定
        const size = 2 + Math.random() * 4;
        const x =
          (Math.sin(currentTime * 0.3 + i * 0.5) * 0.5 + 0.5) * canvas.width;
        const y =
          (Math.cos(currentTime * 0.2 + i * 0.7) * 0.5 + 0.5) * canvas.height;

        // 明るさの調整（時間によって明滅）
        const brightness = 0.5 + 0.5 * Math.sin(currentTime * 2 + i);

        // 光の粒子を描画
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 光の筋
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 10; i++) {
        const startX = Math.random() * canvas.width;
        const startY = 0;
        const angle = Math.PI / 6 + Math.random() * (Math.PI / 3);
        const length = canvas.height * 1.5;
        const width = 20 + Math.random() * 40;

        // 時間経過で動く光の角度
        const moveAngle = angle + Math.sin(currentTime * 0.2 + i) * 0.2;

        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(moveAngle);

        // 光のグラデーション
        const lightGradient = ctx.createLinearGradient(0, 0, 0, length);
        lightGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        lightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = lightGradient;
        ctx.fillRect(-width / 2, 0, width, length);
        ctx.restore();
      }

      // 水の揺らぎ効果（波紋）を描画
      ctx.globalAlpha = 0.08;

      // 複数の波紋を描画
      for (let i = 0; i < 4; i++) {
        const amplitude = 10 + i * 4; // 波の振幅
        const frequency = 0.015 - i * 0.003; // 波の周波数
        const speed = 0.3 + i * 0.1; // 波の速度

        ctx.beginPath();

        // 複雑な波紋パターン
        for (let x = 0; x < canvas.width; x += 30) {
          for (let y = 0; y < canvas.height; y += 30) {
            const waveOffset1 =
              Math.sin(x * frequency + currentTime * speed) * amplitude;
            const waveOffset2 =
              Math.cos(y * frequency * 1.3 + currentTime * (speed * 0.7)) *
              amplitude;
            const combinedOffset = waveOffset1 + waveOffset2;

            const circleSize = 15 + combinedOffset * 0.4;

            ctx.moveTo(x + circleSize, y);
            ctx.arc(x, y, circleSize, 0, Math.PI * 2);
          }
        }

        // 波紋の色（青色の異なる色調）
        const colors = ["#5fb3ff", "#4a9ad9", "#3d85c6", "#2a5298"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
      }

      // 透明度を元に戻す
      ctx.globalAlpha = 1.0;
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

      // キャンバスサイズを再設定（スタート時に適切なサイズにするため）
      resizeCanvas();

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
        const orientationMessage = document.getElementById(
          "orientation-message"
        );

        if (orientationMessage) {
          if (window.orientation === 90 || window.orientation === -90) {
            // 横向き
            orientationMessage.style.display = "flex";
          } else {
            // 縦向き
            orientationMessage.style.display = "none";
            // 縦向きに戻ったときにキャンバスサイズを再調整
            setTimeout(resizeCanvas, 300); // 向き変更後に少し遅延させてサイズを調整
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
  } catch (err) {
    console.error("ゲーム初期化エラー:", err);
  }
});
