document.addEventListener('DOMContentLoaded', async () => {
    // DOM要素
    const rouletteInner = document.getElementById('roulette-inner');
    const spinButton = document.getElementById('spin-button');
    const resultElement = document.getElementById('result');
    const totalsElement = document.getElementById('totals');
    const historyList = document.getElementById('history-list');
    const rouletteButtons = document.getElementById('roulette-buttons');
    const resetTotalsButton = document.getElementById('reset-totals-button');
    const totalDaysSummarySpan = document.getElementById('total-days-summary');
    const developerToolsSection = document.getElementById('developer-tools'); // ★ 開発者ツールセクションを取得

    // --- 設定関連要素 ---
    const addRouletteBtn = document.getElementById('add-roulette');
    // Viewer
    const itemList = document.getElementById('item-list');
    // Modifier
    const itemTypeSelect = document.getElementById('item-type');
    const itemDaysInput = document.getElementById('item-days');
    const itemValueInput = document.getElementById('item-value');
    const addItemButton = document.getElementById('add-item-button');
    const updateRouletteButton = document.getElementById('update-roulette-button');
    const deleteRouletteButton = document.getElementById('delete-roulette-button');
    const fullResetButton = document.getElementById('full-reset-button');
    // --- ここまで ---

    // 色のリスト
    // ★★★ 白いラベルとのコントラストを考慮し、白や非常に明るい色は避ける ★★★
    const colors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#d35400', '#34495e', '#e67e22', '#16a085'
    ];

    // --- ★★★ 初回起動時にJSONから設定を読み込む ★★★ ---
    async function initializeRoulettesFromJSON() {
        const initializedKey = 'roulette_init_from_json_v1'; // バージョン管理用キー
        if (!localStorage.getItem(initializedKey)) {
            try {
                console.log('初回アクセスです。roulettes_init.json から設定を読み込みます...');
                const response = await fetch('roulettes_init.json'); // JSONファイルをfetch
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const initialRoulettes = await response.json(); // JSONをパース

                // localStorageに保存 (既存の 'roulettes' を上書きする形になる)
                localStorage.setItem('roulettes', JSON.stringify(initialRoulettes));
                localStorage.setItem(initializedKey, 'true'); // 初期化済みフラグを設定
                console.log('初期設定をlocalStorageに保存しました。');
                // 読み込んだデータを現在の変数にも反映させる
                roulettes = initialRoulettes;
            } catch (error) {
                console.error('初期ルーレット設定の読み込みに失敗しました:', error);
                alert('初期ルーレット設定の読み込みに失敗しました。デフォルト設定で開始します。\n' + error);
                // エラー時は最低限のデフォルト設定を保証する (任意)
                if (!roulettes || Object.keys(roulettes).length === 0 || !roulettes.default) {
                    roulettes = {
                        "default": {
                            "禁酒継続": 50, "飲んでOK": 20, "ノンアル1杯": 30
                        }
                    };
                    // この場合、saveRoulettes() は不要（次回読み込み直すため）
                    // localStorage.setItem(initializedKey, 'true'); // エラーでもフラグは立ててループを防ぐ
                }
            }
        } else {
             console.log('初期設定済みです。localStorageから設定を読み込みます。');
             // 初期化済みの場合はlocalStorageから読み込む (loadRoulettes関数で既に行われている)
             roulettes = loadRoulettes(); // 念のため再読み込み
        }
    }
    // --- ここまで初期化処理 ---

    // --- グローバル変数 (roulettes, currentRoulette など) ---
    let roulettes = {}; // ★ 初期化を空にする (initializeで設定される)
    let currentRoulette = 'default'; // デフォルトは固定
    let spinning = false;
    let totals = loadTotals(); // totals, history は従来通りlocalStorageから
    let history = loadHistory();

    // --- 一時的な設定データ (リスト表示用) ---
    let currentConfigItems = [];
    // --- ここまで ---

    // --- ★★★ 初期化処理の実行 ★★★ ---
    await initializeRoulettesFromJSON(); // ★ JSON読み込み完了を待つ

    // --- UI初期化 (JSON読み込み後に行う) ---
    initializeRouletteButtons();
    loadCurrentRouletteConfig();
    updateTotalsDisplay();
    updateHistoryDisplay();
    createRouletteDisplay();
    toggleDeleteButtonVisibility();

    // --- ★★★ 開発者ツールの表示制御 ★★★ ---
    function checkAndShowDeveloperTools() {
        if (window.location.hash === '#dev') {
            if (developerToolsSection) {
                // CSSで display: flex を設定しているので、それに合わせる
                developerToolsSection.style.display = 'flex';
                console.log('開発者ツールを表示しました。');
            }
        } else {
             if (developerToolsSection) {
                developerToolsSection.style.display = 'none'; // 念のため非表示に
            }
        }
    }
    checkAndShowDeveloperTools(); // ページ読み込み時に実行
    // ハッシュが動的に変更された場合にも対応 (オプション)
    // window.addEventListener('hashchange', checkAndShowDeveloperTools);

    // イベントリスナー
    spinButton.addEventListener('click', spinRoulette);
    addRouletteBtn.addEventListener('click', handleAddRoulette);
    resetTotalsButton.addEventListener('click', handleResetTotals);
    addItemButton.addEventListener('click', handleAddItem);
    updateRouletteButton.addEventListener('click', handleUpdateRoulette);
    itemList.addEventListener('click', handleDeleteItem);
    deleteRouletteButton.addEventListener('click', handleDeleteRoulette);
    fullResetButton.addEventListener('click', handleFullReset);

    // ルーレットボタンの初期化
    function initializeRouletteButtons() {
        // ★★★ デフォルト作成ロジックは不要 ★★★

        // roulettes データに基づいてボタンを生成
        rouletteButtons.innerHTML = ''; // ボタンエリアをクリア
        for (const key in roulettes) {
            // 'default' ボタンも動的に生成する方が整合性が取れる
            createRouletteButton(key, key === currentRoulette);
        }

        // すべてのルーレットボタンにイベントリスナーを設定 (生成後に実行)
        document.querySelectorAll('.roulette-button').forEach(btn => {
            const name = btn.dataset.name;
            btn.removeEventListener('click', buttonClickHandler);
            btn.addEventListener('click', buttonClickHandler);
            // ハイライト処理は buttonClickHandler 内で行われる
        });
         // 初期状態でアクティブなボタンを再確認
        const activeButton = document.querySelector(`.roulette-button[data-name="${currentRoulette}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        } else if (Object.keys(roulettes).length > 0) {
            // アクティブなものがない場合、最初のものをアクティブにする (フォールバック)
             const firstButton = rouletteButtons.querySelector('.roulette-button');
             if (firstButton) {
                 firstButton.click(); // クリックイベントを発火させて状態を更新
             }
        }
    }

    // ボタンクリックハンドラ（共通処理）
    function buttonClickHandler(event) {
        const button = event.currentTarget;
        const name = button.dataset.name;
        
        // 他のボタンからactiveクラスを削除
        document.querySelectorAll('.roulette-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // クリックされたボタンにactiveクラスを追加
        button.classList.add('active');
        
        // 現在のルーレットを更新
        currentRoulette = name;
        loadCurrentRouletteConfig();
        createRouletteDisplay();
        toggleDeleteButtonVisibility();
    }

    // ルーレットボタンを追加
    function createRouletteButton(name, isActive = false) {
        // 同じ名前のボタンがすでに存在するかチェック
        const existingButton = document.querySelector(`.roulette-button[data-name="${name}"]`);
        if (existingButton) {
            return existingButton;
        }
        
        const button = document.createElement('button');
        button.className = `roulette-button ${isActive ? 'active' : ''}`;
        button.textContent = name;
        button.dataset.name = name;
        
        button.addEventListener('click', buttonClickHandler);
        
        rouletteButtons.appendChild(button);
        return button;
    }

    // --- ヘルパー関数: 半角数字を全角数字に変換 ---
    function toFullWidth(str) {
        // 文字列に変換してから置換
        return String(str).replace(/[0-9]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
        });
    }

    // --- ★★★ ヘルパー関数: キー文字列 (+-X日) をパース ---
    function parseKeyString(key) {
        const matchPlus = key.match(/^\+(\d+)日$/);
        const matchMinus = key.match(/^\-(\d+)日$/);

        if (matchPlus) {
            return { type: '+', days: parseInt(matchPlus[1], 10) };
        } else if (matchMinus) {
            return { type: '-', days: parseInt(matchMinus[1], 10) };
        } else {
            return null; // パース失敗
        }
    }

    // 現在のルーレット設定を読み込み、フォームに表示
    function loadCurrentRouletteConfig() {
        currentConfigItems = []; // 一時データをクリア
        const config = roulettes[currentRoulette] || {};
        for (const key in config) {
            const parsed = parseKeyString(key); // ★ヘルパー関数を使用
            const value = config[key];

            if (parsed && typeof value === 'number') {
                 currentConfigItems.push({ type: parsed.type, days: parsed.days, value });
            } else {
                // +-X日 形式でないキーや不正な値を持つ項目は無視するか、
                // 別の方法で currentConfigItems に保持する（今回は無視）
                console.warn(`Ignoring invalid config item: ${key}: ${value}`);
            }
        }
        renderItemList(); // リスト表示を更新
    }

    // ルーレット表示の作成
    function createRouletteDisplay() {
        // ★★★ トランジションを一時的に無効化 ★★★
        const originalTransition = rouletteInner.style.transition;
        rouletteInner.style.transition = 'none';

        // 元の設定データを取得
        const config = roulettes[currentRoulette];

        if (!config || Object.keys(config).length === 0) {
            rouletteInner.innerHTML = '<div style="color: red; text-align: center; padding-top: 40%;">設定が空です</div>';
            // ★★★ 早期リターン前にもトランジションを戻す（念のため）★★★
            // rouletteInner.style.transition = originalTransition; // or ''
            return;
        }

        // 設定値の合計を計算
        let totalValue = 0;
        for (const key in config) {
            if (typeof config[key] === 'number' && config[key] > 0) {
                totalValue += config[key];
            }
        }

        if (totalValue <= 0) {
            rouletteInner.innerHTML = '<div style="color: red; text-align: center; padding-top: 40%;">有効な設定値がありません</div>';
            // ★★★ 早期リターン前にもトランジションを戻す（念のため）★★★
            // rouletteInner.style.transition = originalTransition; // or ''
            return;
        }

        // ルーレット内部をクリアし、角度をリセット
        rouletteInner.innerHTML = '';
        rouletteInner.style.transform = 'rotate(0deg)';

        // ★★★ ブラウザの描画を待ってからトランジションを元に戻す（より安全）★★★
        requestAnimationFrame(() => {
             requestAnimationFrame(() => { // 念のため2フレーム待つ
                 // アニメーションには不要なので、デフォルトのトランジションは設定しないことにする
                 // rouletteInner.style.transition = originalTransition; // or ''
                 // spinRoulette 内で必要に応じて設定される
             });
        });

        // 累積角度の初期化
        let cumulativeAngle = 0;
        let index = 0; // 色選択用のインデックス

        // 元の設定データに基づいて扇形を作成
        for (const key in config) {
            const value = config[key];
            if (typeof value !== 'number' || value <= 0) continue;

            // 色を選択
            const colorIndex = index % colors.length;
            const color = colors[colorIndex];

            // ★★★ 変更点: 元の値の比率から正確な角度を計算 ★★★
            const sectionAngle = (value / totalValue) * 360;
            const percentage = (value / totalValue) * 100; // 表示用の正確なパーセンテージ

            // 扇形のコンテナを作成 (以降のSVG描画ロジックはほぼ同じ)
            const section = document.createElement('div');
            section.className = 'roulette-section';
            section.style.position = 'absolute';
            section.style.top = '0';
            section.style.left = '0';
            section.style.width = '100%';
            section.style.height = '100%';

            // SVG要素を作成
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // 扇形の開始角度と終了角度 (時計回り)
            const startAngle = cumulativeAngle;
            const endAngle = startAngle + sectionAngle;

            // 扇形の開始点と終了点の座標を計算
            const cx = 50;
            const cy = 50;
            const radius = 50;
            const startX = cx + radius * Math.cos(startAngle * Math.PI / 180);
            const startY = cy + radius * Math.sin(startAngle * Math.PI / 180);
            const endX = cx + radius * Math.cos(endAngle * Math.PI / 180);
            const endY = cy + radius * Math.sin(endAngle * Math.PI / 180);

            const largeArcFlag = sectionAngle > 180 ? 1 : 0;
            const sweepFlag = 1;
            const d = `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY} Z`;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', color);

            // データ属性に情報を保存 (角度は正確な値になる)
            section.dataset.item = key; // キーを保存
            section.dataset.startAngle = startAngle;
            section.dataset.endAngle = endAngle;
            section.dataset.probability = percentage; // 正確なパーセンテージを保存 (オプション)

            svg.appendChild(path);
            section.appendChild(svg);

            // テキストラベルを追加
            const labelAngle = startAngle + sectionAngle / 2;
            const adjustedRadius = sectionAngle < 20 ? radius * 0.5 : radius * 0.7;
            const labelX = cx + adjustedRadius * Math.cos(labelAngle * Math.PI / 180);
            const labelY = cy + adjustedRadius * Math.sin(labelAngle * Math.PI / 180);

            const label = document.createElement('div');
            label.className = 'section-label';
            label.style.position = 'absolute';
            label.style.left = labelX + '%';
            label.style.top = labelY + '%';
            label.style.transform = `translate(-50%, -50%)`;
            label.style.color = 'white';
            label.style.fontWeight = 'bold';
            label.style.fontSize = sectionAngle < 20 ? '16px' : '18px'; // 1.5倍に拡大
            label.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            label.style.whiteSpace = 'nowrap';

            // ★★★ 変更点: ラベルのテキストに正確なパーセンテージを表示 (小数点以下1桁) ★★★
            label.textContent = `${key} (${percentage.toFixed(1)}%)`;

            section.appendChild(label);
            rouletteInner.appendChild(section);

            // 次のセクションの開始角度を更新
            cumulativeAngle = endAngle;
            index++; // 色選択用のインデックスを増やす
        }
    }

    // 項目リスト表示を更新
    function renderItemList() {
        itemList.innerHTML = ''; // いったんクリア
        currentConfigItems.forEach((item, index) => {
            const li = document.createElement('li');

            // ★★★ 表示形式を変更 ★★★
            const typeSymbol = item.type === '+' ? '＋' : '－';
            const fullWidthDays = toFullWidth(item.days);
            // キー文字列: 例 "＋３日"
            const keyString = `${typeSymbol}${fullWidthDays}日`;
            // 表示文字列: 例 "＋３日（比率：５０％）"
            const displayString = `${keyString}（比率：${item.value}％）`;

            li.innerHTML = `
                <span class="item-name">${displayString}</span>
                <button class="delete-item-button" data-index="${index}">削除</button>
            `;
            itemList.appendChild(li);
        });
    }

    // 項目追加ボタンの処理
    function handleAddItem() {
        const type = itemTypeSelect.value;
        const days = parseInt(itemDaysInput.value, 10);
        const value = parseInt(itemValueInput.value, 10);

        // 入力チェック
        if (isNaN(days) || days < 0) {
            alert('日数は0以上の数値を入力してください。');
            return;
        }
        if (isNaN(value) || value <= 0) {
            alert('比率は1以上の数値を入力してください。');
            return;
        }

        // 項目キーを作成
        const keyString = `${type}${days}日`;

        // 同じキーが既にないかチェック (任意: 上書きや警告も可)
        // if (currentConfigItems.some(item => `${item.type}${item.days}日` === keyString)) {
        //     alert('同じ日数の項目が既に存在します。');
        //     return;
        // }

        // 一時データに追加
        currentConfigItems.push({ type, days, value });
        renderItemList(); // リスト表示を更新

        // 入力欄をクリア
        itemDaysInput.value = '';
        itemValueInput.value = '';
        itemTypeSelect.value = '+'; // デフォルトに戻す
        itemDaysInput.focus(); // 次の入力へ
    }

    // 項目削除ボタンの処理 (イベント委任)
    function handleDeleteItem(event) {
        if (event.target.classList.contains('delete-item-button')) {
            const index = parseInt(event.target.dataset.index, 10);
            if (!isNaN(index) && index >= 0 && index < currentConfigItems.length) {
                currentConfigItems.splice(index, 1); // 配列から削除
                renderItemList(); // リスト表示を更新
            }
        }
    }

    // ルーレット更新ボタンの処理
    function handleUpdateRoulette() {
        if (currentConfigItems.length === 0) {
            alert('少なくとも1つの項目が必要です。');
            return;
        }

        const newConfig = {};
        let totalValueCheck = 0;
        for (const item of currentConfigItems) {
            const keyString = `${item.type}${item.days}日`;
            // 同じキーがあれば値を上書き（またはエラー処理）
            if (newConfig[keyString]) {
                 alert(`エラー: 項目 "${keyString}" が重複しています。削除するか修正してください。`);
                 return; // 更新を中断
            }
            // ここでは元のvalueを使う（まだ調整前）
            newConfig[keyString] = item.value;
            totalValueCheck += item.value;
        }

        // ★★★ 比率の合計を100に自動調整 ★★★
        if (totalValueCheck !== 100 && currentConfigItems.length > 0) {
            const lastItemIndex = currentConfigItems.length - 1;
            const lastItem = currentConfigItems[lastItemIndex];
            const lastItemKey = `${lastItem.type}${lastItem.days}日`;
            const difference = 100 - totalValueCheck;
            const adjustedValue = lastItem.value + difference;

            if (adjustedValue <= 0) {
                alert(`エラー: 比率の合計が${totalValueCheck}%です。最後の項目「${lastItemKey}」を調整しても比率が0%以下になってしまうため、合計100%にできません。各項目の比率を見直してください。`);
                return; // 更新を中断
            }

            // 調整後の値を適用
            lastItem.value = adjustedValue; // currentConfigItemsも更新
            newConfig[lastItemKey] = adjustedValue; // newConfigも更新

            // 調整したことをユーザーに通知し、リスト表示も更新
            renderItemList(); // 表示を更新して調整後の値を見せる
            alert(`比率の合計が${totalValueCheck}%だったため、最後の項目「${lastItemKey}」の比率を${adjustedValue}％に自動調整しました。`);

            // totalValueCheckを更新 (後のバリデーションのため)
            totalValueCheck = 100;
        }
        // ★★★ ここまで自動調整ロジック ★★★


        // 念のため、調整後（または元々100だった場合）に再度チェック
         if (totalValueCheck <= 0) {
             // このケースは通常、調整ロジックで弾かれるはずだが、念のため残す
             alert('エラー: 比率の合計が0以下です。');
             return;
         }


        // 現在のルーレットの設定を更新
        roulettes[currentRoulette] = newConfig;
        saveRoulettes(); // ローカルストレージに保存
        createRouletteDisplay(); // ルーレット表示を更新
        alert('ルーレットを更新しました。');
    }

    // 合計表示の更新 ★★★ 修正 ★★★
    function updateTotalsDisplay() {
        totalsElement.innerHTML = ''; // いったんクリア
        let totalDaysSum = 0; // 合計日数の初期化

        // 各項目のカウントを表示し、日数を集計
        for (const key in totals) {
            const count = totals[key];
            const item = document.createElement('div');
            item.className = 'total-item';

            // 日数をパース
            const parsedKey = parseKeyString(key);
            if (parsedKey) {
                const daysValue = parsedKey.days;
                const countValue = typeof count === 'number' ? count : 0;
                if (parsedKey.type === '+') {
                    totalDaysSum += daysValue * countValue;
                } else {
                    totalDaysSum -= daysValue * countValue;
                }
                // 全角で表示
                const typeSymbol = parsedKey.type === '+' ? '＋' : '－';
                const fullWidthDays = toFullWidth(daysValue);
                item.textContent = `${typeSymbol}${fullWidthDays}日: ${countValue}回`;
            } else {
                // パースできないキー（例: "禁酒継続" など）もそのまま表示
                item.textContent = `${key}: ${count}回`;
            }

            totalsElement.appendChild(item);
        }

        // 合計日数を表示 (★★★ 見出しのspanを更新 ★★★)
        const sumPrefix = totalDaysSum >= 0 ? '＋' : '－';
        const absSumDays = Math.abs(totalDaysSum);
        const fullWidthSumDays = toFullWidth(absSumDays);
        // 見出し横のspanにテキストを設定
        totalDaysSummarySpan.textContent = `：${sumPrefix}${fullWidthSumDays}日`;
    }

    // 履歴表示の更新
    function updateHistoryDisplay() {
        historyList.innerHTML = '';
        
        history.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.time}: ${item.result}`;
            historyList.appendChild(li);
        });
    }

    // ローカルストレージからの読み込み
    function loadRoulettes() {
        try {
            const data = localStorage.getItem('roulettes');
            const parsed = data ? JSON.parse(data) : {};
            return parsed;
        } catch (error) {
            return {};
        }
    }
    
    function loadTotals() {
        try {
            const data = localStorage.getItem('totals');
            return data ? JSON.parse(data) : {};
        } catch (error) {
            return {};
        }
    }
    
    function loadHistory() {
        try {
            const data = localStorage.getItem('history');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }
    
    // ローカルストレージへの保存
    function saveRoulettes() {
        try {
            localStorage.setItem('roulettes', JSON.stringify(roulettes));
        } catch (error) {
            alert('設定の保存に失敗しました: ' + error.message);
        }
    }
    
    function saveTotals() {
        try {
            localStorage.setItem('totals', JSON.stringify(totals));
        } catch (error) {
            // console.error('集計保存エラー:', error); // エラーログは任意で
            alert('集計の保存に失敗しました: ' + error.message);
        }
    }
    
    function saveHistory() {
        try {
            localStorage.setItem('history', JSON.stringify(history));
        } catch (error) {
            // console.error('履歴保存エラー:', error); // エラーログは任意で
            alert('履歴の保存に失敗しました: ' + error.message);
        }
    }

    // 合計リセット処理
    function handleResetTotals() {
        if (!confirm('本当に合計をリセットしますか？この操作は元に戻せません。')) {
            return; // キャンセルされたら何もしない
        }

        // 履歴にリセット記録を追加
        const timestamp = new Date().toLocaleString();
        history.unshift({ time: timestamp, result: '合計をリセットしました' });
        if (history.length > 100) { // 履歴上限は維持
            history.pop();
        }
        saveHistory(); // 更新された履歴を保存
        updateHistoryDisplay(); // 履歴表示を更新

        // 合計をリセット
        totals = {}; // 空のオブジェクトにする
        saveTotals(); // 空の合計データを保存
        updateTotalsDisplay(); // 合計表示を更新 (空になる)

        alert('合計をリセットしました。');
    }

    // ルーレット回転処理を async 関数に変更
    async function spinRoulette() {
        if (spinning) return;
        spinning = true;
        spinButton.disabled = true;

        // --- 1. 現在角度取得とリセット ---
        const currentAngleCCW = getRotationDegrees(rouletteInner);
        // 現在の角度の360度剰余を計算 (これがリセット後の角度)
        const resetAngleCss = currentAngleCCW % 360;

        rouletteInner.style.transition = 'none'; // アニメーションを一時停止
        rouletteInner.style.transform = `rotate(${resetAngleCss}deg)`; // 角度をリセット

        // ブラウザの再描画を待つ (重要: これがないとリセットが効かない場合がある)
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve)); // 念のため2回

        // --- 2. 目標角度計算 ---
        const items = getRouletteItems();
        if (items.length === 0) {
            spinning = false;
            spinButton.disabled = false;
            return;
        }
        const result = determineResult(items);

        const resultSection = document.querySelector(`.roulette-section[data-item="${result.key}"]`);
        if (!resultSection) {
            spinning = false;
            spinButton.disabled = false;
            return;
        }

        const startAngle = parseFloat(resultSection.dataset.startAngle);
        const endAngle = parseFloat(resultSection.dataset.endAngle);
        const middleAngle = (startAngle + endAngle) / 2;
        const MARKER_POSITION = 270;
        const targetRotation = MARKER_POSITION - middleAngle; // 時計回りの目標オフセット
        const randomOffset = Math.random() * 20 - 10;
        const finalTargetAngleCW = (targetRotation + randomOffset + 360) % 360; // 最終的な時計回り停止角度(0-360)
        const finalTargetAngleCCW = -finalTargetAngleCW; // 対応する反時計回りの角度

        const baseRotationCCW = -3600; // 最低10周に戻す

        // --- 3. アニメーション目標設定 ---
        // リセット後の角度(resetAngleCss)からスタートし、最終的に finalTargetAngleCCW + baseRotationCCW に到達する
        // (注: アニメーションの目標値は絶対角度なので、resetAngleCssを考慮する必要はない)
        const animationFinalCssAngle = finalTargetAngleCCW + baseRotationCCW;

        // --- 4. アニメーション開始 ---
        rouletteInner.style.transition = 'transform 5s cubic-bezier(0.2, 0.1, 0.25, 1.0)'; // アニメーションを再度有効に
        rouletteInner.style.transform = `rotate(${animationFinalCssAngle}deg)`;

        // 結果表示 (setTimeout内は変更なし)
        setTimeout(() => {
            const actualRotation = getRotationDegrees(rouletteInner);
            const svgRotation = (actualRotation % 360 + 360) % 360; // 時計回り仮説
            const markerPointsTo = (MARKER_POSITION - svgRotation + 360) % 360;

            let actualResult = null;
            const sections = document.querySelectorAll('.roulette-section');
            for (const section of sections) {
                const secStart = parseFloat(section.dataset.startAngle);
                const secEnd = parseFloat(section.dataset.endAngle);
                const itemName = section.dataset.item;
                const isBetween = isAngleBetween(markerPointsTo, secStart, secEnd);
                if (isBetween) {
                    actualResult = itemName;
                    break;
                }
            }

            const compensatingRotationCSS = -actualRotation; // ラベル補正 (反時計回り仮説)
            document.querySelectorAll('.section-label').forEach(label => {
                label.style.transform = `translate(-50%, -50%) rotate(${compensatingRotationCSS}deg)`;
            });

            if (!actualResult) {
                actualResult = result.key;
            }

            resultElement.textContent = actualResult;

            if (!totals[actualResult]) {
                totals[actualResult] = 0;
            }
            totals[actualResult]++;
            saveTotals();
            updateTotalsDisplay();

            const timestamp = new Date().toLocaleString();
            history.unshift({ time: timestamp, result: actualResult });
            if (history.length > 100) {
                history.pop();
            }
            saveHistory();
            updateHistoryDisplay();

            spinning = false;
            spinButton.disabled = false;
        }, 5000);
    }

    // 角度が範囲内にあるかをチェックする関数（360度をまたぐ場合も対応）
    function isAngleBetween(angle, start, end) {
        // 角度を0-360度の範囲に正規化（入力値も）
        angle = (angle % 360 + 360) % 360;
        start = (start % 360 + 360) % 360;
        end = (end % 360 + 360) % 360;

        // 通常のケース: 開始角度 <= 終了角度
        // 終了角度が0の場合、360として扱うことで境界問題をハンドリングしやすくする
        const effectiveEnd = (end === 0) ? 360 : end;

        if (start < effectiveEnd) { // 0度をまたがない場合 (例: 10度から50度)
            // 終了角度を含むように <= に変更する（セクションの境界線上にピッタリ止まった場合を考慮）
            // ただし、終了角度が 360 (元の 0) の場合は < のままにする
            if (effectiveEnd === 360) {
                return start <= angle && angle < effectiveEnd;
            } else {
                return start <= angle && angle <= effectiveEnd;
            }
        }
        // 範囲が360度をまたぐケース (例: 350度から20度)
        else {
            // 開始角度以上、または終了角度 *以下*
            return start <= angle || angle <= effectiveEnd;
        }
    }

    // 結果を決定する関数
    function determineResult(items) {
        const randomValue = Math.random() * 100;
        let cumulativeProbability = 0;
        
        for (const item of items) {
            cumulativeProbability += item.value;
            if (randomValue < cumulativeProbability) {
                return item;
            }
        }
        
        // 万が一の場合は最後の項目を返す
        return items[items.length - 1];
    }

    // 要素の現在の回転角度を取得する関数
    function getRotationDegrees(element) {
        const style = window.getComputedStyle(element);
        const transform = style.getPropertyValue('transform');

        if (transform === 'none' || !transform.includes('matrix')) {
            return 0;
        }
        
        const values = transform.split('(')[1].split(')')[0].split(',');
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));

        return angle;
    }

    // ルーレット項目リストの取得
    function getRouletteItems() {
        const config = roulettes[currentRoulette];
        const items = [];
        
        if (!config || Object.keys(config).length === 0) {
            return [];
        }
        
        // 確率の合計を計算
        let totalProbability = 0;
        for (const key in config) {
            totalProbability += config[key];
        }
        
        // 項目と正規化された確率を追加
        for (const key in config) {
            const normalizedProb = Math.round((config[key] / totalProbability) * 100);
            items.push({
                key: key,
                value: normalizedProb
            });
        }
        
        return items;
    }

    // --- ★★★ handleAddRoulette 関数を再実装 ★★★ ---
    function handleAddRoulette() {
        const name = prompt('新しいルーレットの名前を入力してください：');
        if (!name || name.trim() === '') return;

        const trimmedName = name.trim(); // 前後の空白を除去

        if (roulettes[trimmedName]) {
            alert('同じ名前のルーレットがすでに存在します');
            return;
        }

        // 新しいルーレットの作成 (デフォルト設定を空にするか、基本的なものを入れるか)
        // ここでは空で作成し、ユーザーがフォームで項目を追加するように促す
        roulettes[trimmedName] = {}; // 空の設定で開始

        saveRoulettes();

        // 新しいボタンを追加し、アクティブにする
        const newButton = createRouletteButton(trimmedName, true);

        // 他のボタンからactiveクラスを削除
        document.querySelectorAll('.roulette-button').forEach(btn => {
            if (btn !== newButton) { // 作成したボタン以外
                btn.classList.remove('active');
            }
        });

        // 現在のルーレットを更新
        currentRoulette = trimmedName;
        loadCurrentRouletteConfig(); // 新しい空の設定をフォームにロード
        createRouletteDisplay();    // ルーレット表示も更新（空になるはず）

        alert(`新しいルーレット "${trimmedName}" を作成しました。項目を追加してください。`);
    }
    // --- ここまで ---

    // --- ★★★ 削除ボタン表示制御関数 ★★★ ---
    function toggleDeleteButtonVisibility() {
        if (currentRoulette === 'default') {
            deleteRouletteButton.style.display = 'none'; // デフォルトは削除不可
        } else {
            deleteRouletteButton.style.display = 'block'; // デフォルト以外なら表示
        }
    }

    // --- ★★★ 現在のルーレット削除処理 ★★★ ---
    function handleDeleteRoulette() {
        if (currentRoulette === 'default') {
            alert('デフォルトのルーレットは削除できません。');
            return;
        }

        if (!confirm(`本当に現在のルーレット「${currentRoulette}」を削除しますか？この操作は元に戻せません。`)) {
            return; // キャンセルされたら何もしない
        }

        // 1. 対応するボタンをDOMから削除
        const buttonToRemove = document.querySelector(`.roulette-button[data-name="${currentRoulette}"]`);
        if (buttonToRemove) {
            rouletteButtons.removeChild(buttonToRemove);
        }

        // 2. roulettesオブジェクトからデータを削除
        delete roulettes[currentRoulette];

        // 3. ローカルストレージに保存
        saveRoulettes();

        // 4. デフォルトルーレットに切り替え
        currentRoulette = 'default';

        // 5. UIを更新してデフォルト状態を表示
        //    - 他のボタンから active クラスを削除 (念のため)
        document.querySelectorAll('.roulette-button').forEach(btn => {
            btn.classList.remove('active');
        });
        //    - デフォルトボタンに active クラスを追加
        const defaultButton = document.querySelector('.roulette-button[data-name="default"]');
        if (defaultButton) {
            defaultButton.classList.add('active');
        }
        //    - 設定フォームとルーレット表示を更新
        loadCurrentRouletteConfig();
        createRouletteDisplay();
        //    - 削除ボタンを非表示に
        toggleDeleteButtonVisibility();

        alert(`ルーレット「${buttonToRemove ? buttonToRemove.textContent : ''}」を削除しました。`);
    }

    // --- ★★★ 完全リセット処理 (開発用) ★★★ ---
    function handleFullReset() {
        if (!confirm('本当に全てのローカルストレージデータを削除し、初期状態に戻しますか？\nこの操作は元に戻せません。（開発用）')) {
            return; // キャンセルされたら何もしない
        }

        try {
            localStorage.clear(); // 全てのlocalStorageデータを削除
            alert('ローカルストレージをクリアしました。ページをリロードします。');
            location.reload(); // ページをリロードして初期化処理を再実行させる
        } catch (error) {
            console.error('完全リセット処理中にエラーが発生しました:', error);
            alert('完全リセットに失敗しました。\n' + error);
        }
    }
}); 