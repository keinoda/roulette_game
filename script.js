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
    let roulettes = {};
    let currentRoulette = 'default';
    let spinning = false;
    let totals = loadTotals();
    let history = loadHistory();
    let rouletteSpinCounts = loadRouletteSpinCounts(); // ★ 追加: ルーレットごとの回転数

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
    spinButton.addEventListener('click', async () => {
        // 連続スピン中は再度クリックできないように設定
        if (spinning) return;
        spinning = true;
        spinButton.disabled = true;
        await spinRoulette();
    });
    addRouletteBtn.addEventListener('click', handleAddRoulette);
    resetTotalsButton.addEventListener('click', handleResetTotals);
    addItemButton.addEventListener('click', handleAddItem);
    updateRouletteButton.addEventListener('click', handleUpdateRoulette);
    itemList.addEventListener('click', handleEditItem);
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
        updateCurrentRouletteSpinCountDisplay(); // ★ 初期回転数を表示
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
        updateCurrentRouletteSpinCountDisplay(); // ★ 回転数表示を更新
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
            return;
        }

        // ルーレット内部をクリアし、角度をリセット
        rouletteInner.innerHTML = '';
        // ★★★ 初期表示の回転を 0deg に戻す ★★★
        rouletteInner.style.transform = 'rotate(0deg)';

        // ★★★ ブラウザの描画を待ってからトランジションを元に戻す（より安全）★★★
        requestAnimationFrame(() => {
             requestAnimationFrame(() => {
                 // スピン時に設定されるため、ここでは不要
             });
        });

        // 累積角度の初期化
        let cumulativeAngle = 0;
        let index = 0;

        // 元の設定データに基づいて扇形を作成
        for (const key in config) {
            const value = config[key];
            if (typeof value !== 'number' || value <= 0) continue;

            // 色を選択
            const colorIndex = index % colors.length;
            const color = colors[colorIndex];

            const sectionAngle = (value / totalValue) * 360;
            const percentage = (value / totalValue) * 100;

            const section = document.createElement('div');
            section.className = 'roulette-section';
            section.style.position = 'absolute';
            section.style.top = '0';
            section.style.left = '0';
            section.style.width = '100%';
            section.style.height = '100%';

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            const startAngle = cumulativeAngle;
            const endAngle = startAngle + sectionAngle;

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

            section.dataset.item = key;
            section.dataset.startAngle = startAngle;
            section.dataset.endAngle = endAngle;
            section.dataset.probability = percentage;

            svg.appendChild(path);
            section.appendChild(svg);

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
            label.style.fontSize = sectionAngle < 20 ? '16px' : '18px';
            label.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            label.style.whiteSpace = 'nowrap';

            label.textContent = `${key} (${percentage.toFixed(1)}%)`;

            section.appendChild(label);
            rouletteInner.appendChild(section);

            cumulativeAngle = endAngle;
            index++;
        }
    }

    // 項目リスト表示を更新
    function renderItemList() {
        itemList.innerHTML = ''; // いったんクリア
        
        // 開発者モードかどうかをチェック
        const isDevMode = window.location.hash === '#dev';
        
        currentConfigItems.forEach((item, index) => {
            const li = document.createElement('li');

            // ★★★ 表示形式を変更（数字と記号を半角に） ★★★
            const typeSymbol = item.type === '+' ? '+' : '-';
            // 日数は半角のまま
            // キー文字列: 例 "+3日"
            const keyString = `${typeSymbol}${item.days}日`;
            // 表示文字列: 例 "+3日（比率：50％）"
            const displayString = `${keyString}（比率：${item.value}％）`;

            // 開発者モードの場合のみ修正ボタンを表示
            if (isDevMode) {
                li.innerHTML = `
                    <span class="item-name">${displayString}</span>
                    <button class="edit-item-button" data-index="${index}">修正</button>
                `;
            } else {
                li.innerHTML = `
                    <span class="item-name">${displayString}</span>
                `;
            }
            
            itemList.appendChild(li);
        });
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

    // 項目修正ボタンの処理 (イベント委任)
    function handleEditItem(event) {
        if (event.target.classList.contains('edit-item-button')) {
            const index = parseInt(event.target.dataset.index, 10);
            if (!isNaN(index) && index >= 0 && index < currentConfigItems.length) {
                const item = currentConfigItems[index];
                
                // フォームに値をセット
                itemTypeSelect.value = item.type;
                itemDaysInput.value = item.days;
                itemValueInput.value = item.value;
                
                // 編集中の項目インデックスを保持
                itemTypeSelect.dataset.editIndex = index;
                
                // 追加ボタンのテキストを「更新」に変更
                addItemButton.textContent = '更新';
                
                // 入力欄にフォーカス
                itemDaysInput.focus();
            }
        }
    }

    // 項目追加ボタンの処理
    function handleAddItem() {
        const type = itemTypeSelect.value;
        const days = parseInt(itemDaysInput.value, 10);
        const value = parseInt(itemValueInput.value, 10);
        
        // 編集中のインデックスを取得
        const editIndex = parseInt(itemTypeSelect.dataset.editIndex, 10);
        const isEditing = !isNaN(editIndex) && editIndex >= 0 && editIndex < currentConfigItems.length;

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

        // 同一キーの重複チェック（編集中の項目自身を除く）
        const hasDuplicate = currentConfigItems.some((item, index) => {
            if (isEditing && index === editIndex) return false; // 編集中の項目自身は無視
            return `${item.type}${item.days}日` === keyString;
        });
        
        if (hasDuplicate) {
            alert(`同じ日数の項目「${keyString}」がすでに存在します。`);
            return;
        }

        if (isEditing) {
            // 既存項目の更新
            currentConfigItems[editIndex] = { type, days, value };
        } else {
            // 新規項目の追加
            currentConfigItems.push({ type, days, value });
        }
        
        renderItemList(); // リスト表示を更新

        // 入力欄をクリア
        itemDaysInput.value = '';
        itemValueInput.value = '';
        itemTypeSelect.value = '+'; // デフォルトに戻す
        
        // 編集モードをリセット
        delete itemTypeSelect.dataset.editIndex;
        addItemButton.textContent = '項目追加';
        
        itemDaysInput.focus(); // 次の入力へ
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

    // --- 合計表示の更新 (ソート追加) ---
    function updateTotalsDisplay() {
        totalsElement.innerHTML = ''; // 各項目のリスト表示エリアをクリア
        let totalDaysSum = 0;

        // totals オブジェクトからアイテム配列を作成しソート
        const items = [];
        for (const key in totals) {
            const count = totals[key];
            const parsed = parseKeyString(key);
            items.push({ key, count, parsed });
            // ★ 合計日数をここで計算しておく
            if (parsed && typeof count === 'number') {
                const daysValue = parsed.days;
                if (parsed.type === '+') {
                    totalDaysSum += daysValue * count;
                } else {
                    totalDaysSum -= daysValue * count;
                }
            }
        }
        items.sort((a, b) => {
            if (a.parsed && b.parsed) {
                const effectiveA = (a.parsed.type === '+' ? a.parsed.days : -a.parsed.days);
                const effectiveB = (b.parsed.type === '+' ? b.parsed.days : -b.parsed.days);
                return effectiveB - effectiveA; // 降順にソート
            } else if (a.parsed) {
                return -1;
            } else if (b.parsed) {
                return 1;
            } else {
                return a.key.localeCompare(b.key);
            }
        });

        // ソートされたアイテムを totalsElement に表示
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'total-item';
            if (item.parsed && typeof item.count === 'number') {
                const daysValue = item.parsed.days;
                const typeSymbol = item.parsed.type === '+' ? '+' : '-';
                // 合計日数の計算はループの先頭で行うように移動
                div.textContent = `${typeSymbol}${daysValue}日: ${item.count}回`;
            } else {
                div.textContent = `${item.key}: ${item.count}回`;
            }
            totalsElement.appendChild(div); // リストに追加
        });

        // ★ 合計日数と合計回転数を専用のSpanに表示 ★
        const totalDaysSummarySpan = document.getElementById('total-days-summary'); // HTML内の既存のSpanを取得

        // 合計日数の表示テキストを作成
        const sumPrefix = totalDaysSum >= 0 ? '+' : '-';
        const absSumDays = Math.abs(totalDaysSum);

        if (totalDaysSummarySpan) {
            // 例: 「：+XX日」のように表示する場合
            totalDaysSummarySpan.textContent = `：${sumPrefix}${absSumDays}日`;
        }
    }

    // 履歴表示の更新
    function updateHistoryDisplay() {
        historyList.innerHTML = '';
        
        history.forEach((item, index) => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.className = 'history-text';
            span.textContent = `${item.time}: ${item.result}`;
            
            if (item.deleted) {
                li.style.textDecoration = 'line-through';
            } else {
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '削除';
                deleteBtn.className = 'delete-history-button';
                deleteBtn.dataset.index = index;
                li.appendChild(deleteBtn);
            }
            li.insertBefore(span, li.firstChild);
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
    
    function loadRouletteSpinCounts() {
        try {
            const data = localStorage.getItem('rouletteSpinCounts');
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('ルーレット回転数の読み込みに失敗しました:', error);
            return {};
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

    function saveRouletteSpinCounts() {
        try {
            localStorage.setItem('rouletteSpinCounts', JSON.stringify(rouletteSpinCounts));
        } catch (error) {
            alert('ルーレット回転数の保存に失敗しました: ' + error.message);
        }
    }

    // 合計リセット処理
    function handleResetTotals() {
        if (!confirm('本当に合計日数と全ルーレットの回転数をリセットしますか？\nこの操作は元に戻せません。')) {
            return; // キャンセルされたら何もしない
        }

        // Mark all existing history items as deleted (line-through)
        history.forEach(item => {
            item.deleted = true;
        });

        // 履歴にリセット記録を追加
        const timestamp = new Date().toLocaleString();
        history.unshift({ time: timestamp, result: '合計をリセットしました', deleted: false });
        if (history.length > 100) { // 履歴上限は維持
            history.pop();
        }
        saveHistory(); // 更新された履歴を保存
        updateHistoryDisplay(); // 履歴表示を更新

        // 合計をリセット
        totals = {}; // 空のオブジェクトにする
        saveTotals(); // 空の合計データを保存

        // ★ 全ルーレットの回転数をリセット
        rouletteSpinCounts = {};
        saveRouletteSpinCounts();

        updateTotalsDisplay(); // 合計表示（日数のみ）を更新
        updateCurrentRouletteSpinCountDisplay(); // 現在のルーレットの回転数表示を更新

        alert('合計日数と全ルーレットの回転数をリセットしました。');
    }

    // 角度が範囲内にあるかをチェックする関数（360度をまたぐ場合も対応）
    function isAngleBetween(angle, start, end) {
        const epsilon = 0.0001; // 浮動小数誤差許容範囲
        angle = (angle + 360) % 360;
        start = (start + 360) % 360;
        end = (end + 360) % 360;

        if (Math.abs(start - end) < epsilon) return true; // 開始と終了がほぼ同じなら常にtrue
        if (start < end) { // 0度をまたがない場合
            return angle >= start - epsilon && angle <= end + epsilon;
        }
        // 0度をまたぐ場合
        return angle >= start - epsilon || angle <= end + epsilon;
    }

    // 結果を決定する関数
    function determineResult(items) {
        // ★★★ items の value は getRouletteItems で高精度化されている想定 ★★★
        const randomValue = Math.random() * 100; // 0-100 の乱数 (高精度)
        let cumulativeProbability = 0;

        for (const item of items) {
            cumulativeProbability += item.value;
            if (randomValue < cumulativeProbability) {
                return item;
            }
        }
        // フォールバック (確率合計が厳密に100にならない場合や誤差で到達する可能性)
        console.warn("Fallback in determineResult, returning last item.");
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
        const angleRad = Math.atan2(b, a); // ラジアンを取得
        const angleDeg = angleRad * (180 / Math.PI); // 度に変換

        return angleDeg; // 浮動小数点数を返す
    }

    // ルーレット項目リストの取得
    function getRouletteItems() {
        const config = roulettes[currentRoulette];
        const items = [];
        if (!config || Object.keys(config).length === 0) return [];

        const total = Object.values(config).reduce((sum, val) => sum + val, 0);
        if (total <= 0) return []; // 合計が0以下の場合は空を返す

        let remaining = 100.0; // 浮動小数で計算
        
        // 確率を高精度で計算
        const entries = Object.entries(config);
        for (let i = 0; i < entries.length - 1; i++) {
            const [key, value] = entries[i];
            if (typeof value !== 'number' || value <= 0) continue; // 無効な値はスキップ

            const prob = (value / total) * 100.0;
            // ★★★ ユーザー指定の小数点3桁で丸める処理は行わず、高精度な値を使う ★★★
            // (または Math.round(prob * 1000) / 1000 などで明示的に丸める)
            // ここでは元の比率に基づく正確な値を使う方が良いかもしれないが、
            // ユーザー提供コードの意図を汲み、最後の調整を優先する
            const preciseValue = prob; // 一旦そのまま保持 or 丸め処理
            items.push({ key, value: preciseValue });
            remaining -= preciseValue;
        }
        
        // 最後の項目で残りを調整
        if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1];
            const lastKey = lastEntry[0];
            const lastValueOriginal = typeof lastEntry[1] === 'number' ? lastEntry[1] : 0;

            if (lastValueOriginal > 0) { // 最後の項目が有効な場合のみ追加
                 // remaining がマイナスにならないように念のためチェック
                const finalValue = Math.max(0, remaining);
                items.push({ key: lastKey, value: finalValue });
            } else if (remaining > 0 && items.length > 0) {
                 // 最後の項目が無効だったが、まだ残り確率があり、他の項目がある場合
                 // 最後の有効な項目に残り確率を足す (やや複雑になるため要検討)
                 // 今回は đơn giản な実装として、無効な最後の項目は無視
                 console.warn("Last item has invalid value, remaining probability might not sum to 100 precisely.");
            }
        }

        // 念のため合計をチェック (デバッグ用)
        const finalSum = items.reduce((sum, item) => sum + item.value, 0);
        if (Math.abs(finalSum - 100.0) > 0.001) {
             console.warn(`getRouletteItems: Probabilities sum to ${finalSum}, not 100.`);
        }

        return items;
    }

    // ルーレット回転処理を async 関数に変更
    async function spinRoulette() {
        resultElement.textContent = '-';

        // 現在の角度取得とリセット
        const currentAngle = getRotationDegrees(rouletteInner);
        const resetAngle = currentAngle % 360;
        rouletteInner.style.transition = 'none';
        rouletteInner.style.transform = `rotate(${resetAngle}deg)`;
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (window.location.hash === '#dev') {
            const baseRotation = -360 * 5; // 5回転分
            const randomAngle = Math.random() * 360; // 0～360° の乱数
            const finalTargetAngle = baseRotation + randomAngle;
            rouletteInner.style.transition = 'none';
            rouletteInner.style.transform = `rotate(${finalTargetAngle}deg)`;

            const actualRotation = getRotationDegrees(rouletteInner);
            const normRotation = ((actualRotation % 360) + 360) % 360;
            const MARKER_POSITION = 270;
            const markerAngle = (MARKER_POSITION - normRotation + 360) % 360;
            let determinedResult = null;
            document.querySelectorAll('.roulette-section').forEach(section => {
                const secStart = parseFloat(section.dataset.startAngle);
                const secEnd = parseFloat(section.dataset.endAngle);
                if (isAngleBetween(markerAngle, secStart, secEnd)) {
                    determinedResult = section.dataset.item;
                }
            });
            if (!determinedResult) {
                console.warn("角度から当選項目が判定できませんでした。フォールバックとして default を使用します。");
                determinedResult = "default";
            }
            resultElement.textContent = determinedResult;
            if (!totals[determinedResult]) totals[determinedResult] = 0;
            totals[determinedResult]++;
            saveTotals();
            updateTotalsDisplay();
            const timestamp = new Date().toLocaleString();
            history.unshift({ time: timestamp, result: determinedResult });
            if (history.length > 100) history.pop();
            saveHistory();
            updateHistoryDisplay();

            // ★ 現在のルーレットの回転数をカウントアップ
            if (!rouletteSpinCounts[currentRoulette]) {
                rouletteSpinCounts[currentRoulette] = 0;
            }
            rouletteSpinCounts[currentRoulette]++;
            saveRouletteSpinCounts();
            updateCurrentRouletteSpinCountDisplay(); // ★ 表示も更新

            const compensatingRotation = -actualRotation;
            document.querySelectorAll('.section-label').forEach(label => {
                label.style.transform = `translate(-50%, -50%) rotate(${compensatingRotation}deg)`;
            });
            spinning = false;
            spinButton.disabled = false;
            return;
        } else {
            const baseRotation = -360 * 5; // 5回転分
            const randomAngle = Math.random() * 360; // 0～360° の乱数
            const finalTargetAngle = baseRotation + randomAngle;
            console.log(`ランダムに選択された最終角度: ${finalTargetAngle.toFixed(2)}deg (基準: 上部 270°)`);
            rouletteInner.style.transition = 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)';
            rouletteInner.style.transform = `rotate(${finalTargetAngle}deg)`;
 
            let transitionHandled = false;
            const onTransitionEnd = () => {
                if (transitionHandled) return;
                transitionHandled = true;
                const actualRotation = getRotationDegrees(rouletteInner);
                const normRotation = ((actualRotation % 360) + 360) % 360;
                const MARKER_POSITION = 270;
                const markerAngle = (MARKER_POSITION - normRotation + 360) % 360;
                let determinedResult = null;
                document.querySelectorAll('.roulette-section').forEach(section => {
                    const secStart = parseFloat(section.dataset.startAngle);
                    const secEnd = parseFloat(section.dataset.endAngle);
                    if (isAngleBetween(markerAngle, secStart, secEnd)) {
                        determinedResult = section.dataset.item;
                    }
                });
                if (!determinedResult) {
                    console.warn("角度から当選項目が判定できませんでした。フォールバックとして default を使用します。");
                    determinedResult = "default";
                }
                console.log(`transitionend: 実際の回転: ${actualRotation.toFixed(2)}deg, 正規化: ${normRotation.toFixed(2)}deg, マーカー角度: ${markerAngle.toFixed(2)}deg`);
                resultElement.textContent = determinedResult;
                if (!totals[determinedResult]) totals[determinedResult] = 0;
                totals[determinedResult]++;
                saveTotals();
                updateTotalsDisplay();
                const timestamp = new Date().toLocaleString();
                history.unshift({ time: timestamp, result: determinedResult });
                if (history.length > 100) history.pop();
                saveHistory();
                updateHistoryDisplay();

                // ★ 現在のルーレットの回転数をカウントアップ
                if (!rouletteSpinCounts[currentRoulette]) {
                    rouletteSpinCounts[currentRoulette] = 0;
                }
                rouletteSpinCounts[currentRoulette]++;
                saveRouletteSpinCounts();
                updateCurrentRouletteSpinCountDisplay(); // ★ 表示も更新

                const compensatingRotation = -actualRotation;
                document.querySelectorAll('.section-label').forEach(label => {
                    label.style.transform = `translate(-50%, -50%) rotate(${compensatingRotation}deg)`;
                });
                spinning = false;
                spinButton.disabled = false;
            };
 
            rouletteInner.addEventListener('transitionend', onTransitionEnd, { once: true });
            // フォールバックとして、2.1秒後に transitionend が発火していなければ onTransitionEnd を強制実行
            setTimeout(onTransitionEnd, 2100);
        }
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

        // 4. rouletteSpinCounts からも削除
        delete rouletteSpinCounts[currentRoulette];
        saveRouletteSpinCounts();

        // 5. デフォルトルーレットに切り替え
        currentRoulette = 'default';

        // 6. UIを更新してデフォルト状態を表示
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
        updateCurrentRouletteSpinCountDisplay(); // ★ 回転数表示も更新

        alert(`ルーレット「${buttonToRemove ? buttonToRemove.textContent : ''}」を削除しました。`);
    }

    // --- ★★★ 完全リセット処理 (開発用) ★★★ ---
    function handleFullReset() {
        if (!confirm('本当に全てのローカルストレージデータを削除し、初期状態に戻しますか？\nこの操作は元に戻せません。（開発用）')) {
            return; // キャンセルされたら何もしない
        }

        try {
            localStorage.clear(); // 全てのlocalStorageデータを削除
            // ★ クリア後、変数を初期状態に戻す (任意だがリロードしない場合に有効)
            roulettes = {};
            currentRoulette = 'default';
            totals = {};
            history = [];
            rouletteSpinCounts = {};
            // 再初期化処理を呼び出すか、リロードする
            alert('ローカルストレージをクリアしました。ページをリロードします。');
            location.reload();
        } catch (error) {
            console.error('完全リセット処理中にエラーが発生しました:', error);
            alert('完全リセットに失敗しました。\n' + error);
        }
    }

    // ★★★ デバッグ用マーカー追加関数 (ユーザー提供) ★★★
    function debugDrawMarker() {
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        // ★ マーカー位置を MARKER_POSITION = 90 に合わせる ★
        marker.style.top = '-10%'; // 少し外側に
        marker.style.left = '50%';
        marker.style.width = '2px';
        marker.style.height = '10%'; // 短くする
        marker.style.backgroundColor = 'red';
        marker.style.transform = 'translateX(-50%)';
        marker.style.zIndex = '10'; // 他の要素より手前に
        // roulette 要素 (rouletteInner の親) に追加
        const rouletteContainer = document.getElementById('roulette');
        if (rouletteContainer) {
            // 既存マーカーがあれば削除
            const existingMarker = rouletteContainer.querySelector('.debug-marker');
            if(existingMarker) existingMarker.remove();
            marker.classList.add('debug-marker'); // クラス付与
            rouletteContainer.appendChild(marker);
        }
    }
    // ★ 初期化時にマーカーを描画 (例) ★
    // debugDrawMarker();

    // ツイートボタンのクリックハンドラを追加
    function handleTweetButtonClick() {
        // total-days-summary に表示されているテキストから禁酒合計日数を抽出（例: "：+7日"）
        var totalDaysElement = document.getElementById('total-days-summary');
        var totalText = totalDaysElement.textContent || "";
        var match = totalText.match(/([+-]?\d+)/);
        if (!match) {
            alert('禁酒日数を取得できませんでした。');
            return;
        }
        var days = parseInt(match[1], 10);
        if (isNaN(days) || days <= 0) {
            alert('有効な禁酒日数がありません。');
            return;
        }

        // totals 変数から内訳を組み立てる（各項目の禁酒回数）
        var items = [];
        for (var key in totals) {
            if (totals.hasOwnProperty(key)) {
                var count = totals[key];
                var parsed = parseKeyString(key);
                items.push({ key: key, count: count, parsed: parsed });
            }
        }
        items.sort(function(a, b) {
            if (a.parsed && b.parsed) {
                var effectiveA = (a.parsed.type === '+' ? a.parsed.days : -a.parsed.days);
                var effectiveB = (b.parsed.type === '+' ? b.parsed.days : -b.parsed.days);
                return effectiveB - effectiveA;
            } else if (a.parsed) {
                return -1;
            } else if (b.parsed) {
                return 1;
            } else {
                return a.key.localeCompare(b.key);
            }
        });
        var breakdown = "";
        items.forEach(function(item) {
            breakdown += item.key + " : " + item.count + "回\n";
        });

        // 今日から days 日後の日付を計算
        var today = new Date();
        var endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        var month = endDate.getMonth() + 1;
        var date = endDate.getDate();

        // ツイート内容の作成：内訳と合計、禁酒終了日を含める
        var tweetMsg = "禁酒結果\n" + breakdown + "\n合計: " + totalText + "\n○○さんは、今日から" + month + "月" + date + "日まで禁酒します！がんばってね！！";
        var twitterUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetMsg);
        window.open(twitterUrl, "_blank");
    }

    // ツイートボタンにクリックイベントを設定
    document.getElementById('tweet-button').addEventListener('click', handleTweetButtonClick);

    // 新規追加: 履歴項目の削除処理
    function handleDeleteHistoryItem(index) {
        const item = history[index];
        if (item && !item.deleted) {
            item.deleted = true;
            // 対応する totals のカウントを減少
            if (totals[item.result] && totals[item.result] > 0) {
                totals[item.result]--;
                if (totals[item.result] <= 0) {
                    delete totals[item.result];
                }
            }
            saveHistory();
            saveTotals();
            updateHistoryDisplay();
            updateTotalsDisplay();
        }
    }

    // 履歴リスト上で削除ボタンがクリックされた場合のイベントリスナー追加
    historyList.addEventListener('click', function(event) {
        if (event.target.classList.contains('delete-history-button')) {
            const index = parseInt(event.target.dataset.index, 10);
            handleDeleteHistoryItem(index);
        }
    });

    // ★ 新しい関数: 現在のルーレットの回転数を表示更新
    function updateCurrentRouletteSpinCountDisplay() {
        const countElement = document.getElementById('current-roulette-spin-count');
        if (countElement) {
            const count = rouletteSpinCounts[currentRoulette] || 0;
            countElement.textContent = ` (${count} 回)`;
        }
    }
}); 