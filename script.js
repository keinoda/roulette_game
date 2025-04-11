document.addEventListener('DOMContentLoaded', async () => {
    // --- 定数定義 ---
    const DEFAULT_ROULETTE_NAME = 'default';
    const LOCAL_STORAGE_KEYS = {
        ROULETTES: 'roulettes',
        TOTALS: 'totals',
        HISTORY: 'history',
        INITIALIZED: 'roulette_init_from_json_v1' // JSONからの初期化済みフラグ
    };
    const COLORS = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#d35400', '#34495e', '#e67e22', '#16a085'
    ];
    const MARKER_POSITION_DEG = 270; // ルーレットマーカーの角度 (真上)
    const BASE_ROTATION_DEG = -3600; // 最低回転数 (10周 * -360度)
    const SPIN_DURATION_MS = 5000; // 回転アニメーションの時間
    const HISTORY_LIMIT = 100; // 履歴の最大保存数
    const DEV_TOOLS_HASH = '#dev'; // 開発者ツール表示用ハッシュ

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

    // --- ローカルストレージ ヘルパー関数 ---
    function getItemFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            // null や undefined の場合に defaultValue を返す
            return data != null ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error(`Failed to load ${key} from localStorage:`, error);
            return defaultValue;
        }
    }

    function setItemInStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to save ${key} to localStorage:`, error);
            alert(`データの保存に失敗しました (${key}): ${error.message}`);
            // 必要に応じてエラーを呼び出し元に伝えるか検討
            // throw error;
        }
    }

    // --- ★★★ 初回起動時にJSONから設定を読み込む ★★★ ---
    async function initializeRoulettesFromJSON() {
        const initializedKey = LOCAL_STORAGE_KEYS.INITIALIZED;
        if (!localStorage.getItem(initializedKey)) { // ここは getItemFromStorage を使わない (フラグの存在のみ確認)
            try {
                console.log('初回アクセスです。roulettes_init.json から設定を読み込みます...');
                const response = await fetch('roulettes_init.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const initialRoulettes = await response.json(); // JSON解析もtry内で行う

                // localStorageに保存 (既存の 'roulettes' を上書きする形になる)
                setItemInStorage(LOCAL_STORAGE_KEYS.ROULETTES, initialRoulettes); // ★ ヘルパー関数使用
                localStorage.setItem(initializedKey, 'true'); // フラグを設定 (ここは直接setItem)
                console.log('初期設定をlocalStorageに保存しました。');
                // 読み込んだデータを現在の変数にも反映させる
                roulettes = initialRoulettes;
            } catch (error) {
                // ★★★ エラーハンドリング変更 ★★★
                console.error('roulettes_init.json の読み込みまたは解析に失敗しました:', error);
                alert(`エラー: 初期設定ファイル (roulettes_init.json) の読み込みに失敗しました。\n\n詳細: ${error.message}\n\nファイルが存在し、有効なJSON形式であることを確認してください。\n最小限のデフォルト設定で続行しますが、設定は保存されません。`);

                // ★★★ 空のデフォルト設定をメモリ上に作成 ★★★
                roulettes = {
                    [DEFAULT_ROULETTE_NAME]: {} // 空の設定
                };
                // 初期化フラグは立てない！
                // localStorage.setItem(initializedKey, 'true');
            }
        } else {
             console.log('初期設定済みです。localStorageから設定を読み込みます。');
             roulettes = loadRoulettes(); // ローカルストレージから読み込む

             // ★★★ ローカルストレージが完全に空の場合のみ、空のデフォルトを作成 ★★★
             if (Object.keys(roulettes).length === 0) {
                console.warn('LocalStorage にルーレット設定が見つかりません。空のデフォルト設定を作成します。');
                roulettes = {
                    [DEFAULT_ROULETTE_NAME]: {} // 空のデフォルト設定を作成
                };
                saveRoulettes(); // 空のデフォルトを保存
             }
             // ★★★ それ以外の場合 (何らかの設定が存在する場合) は、読み込んだデータをそのまま使用する ★★★
             // (以前の default が存在しない場合に強制追加するロジックは削除)
        }
    }
    // --- ここまで初期化処理 ---

    // --- グローバル変数 (roulettes, currentRoulette など) ---
    let roulettes = {};
    let currentRoulette = DEFAULT_ROULETTE_NAME; // ★ 定数使用
    let spinning = false;
    let totals = loadTotals();
    let history = loadHistory();
    let currentConfigItems = []; // 設定変更用の一時データ

    // --- ★★★ 初期化処理の実行 ★★★ ---
    await initializeRoulettesFromJSON(); // JSON読み込み完了を待つ

    // --- UI初期化 (JSON読み込み後に行う) ---
    initializeRouletteButtons();
    loadCurrentRouletteConfig();
    updateTotalsDisplay();
    updateHistoryDisplay();
    createRouletteDisplay();
    toggleDeleteButtonVisibility();
    checkAndShowDeveloperTools(); // 開発者ツール表示チェック

    // --- イベントリスナー ---
    spinButton.addEventListener('click', spinRoulette);
    addRouletteBtn.addEventListener('click', handleAddRoulette);
    resetTotalsButton.addEventListener('click', handleResetTotals);
    addItemButton.addEventListener('click', handleAddItem);
    updateRouletteButton.addEventListener('click', handleUpdateRoulette);
    itemList.addEventListener('click', handleDeleteItem);
    deleteRouletteButton.addEventListener('click', handleDeleteRoulette);
    fullResetButton.addEventListener('click', handleFullReset);
    // ハッシュ変更時の開発者ツール表示制御 (オプション)
    // window.addEventListener('hashchange', checkAndShowDeveloperTools);

    // --- ローカルストレージからの読み込み (ヘルパー関数使用) ---
    function loadRoulettes() {
        return getItemFromStorage(LOCAL_STORAGE_KEYS.ROULETTES, {}); // デフォルトは空オブジェクト
    }

    function loadTotals() {
        return getItemFromStorage(LOCAL_STORAGE_KEYS.TOTALS, {}); // デフォルトは空オブジェクト
    }

    function loadHistory() {
        return getItemFromStorage(LOCAL_STORAGE_KEYS.HISTORY, []); // デフォルトは空配列
    }

    // --- ローカルストレージへの保存 (ヘルパー関数使用) ---
    function saveRoulettes() {
        setItemInStorage(LOCAL_STORAGE_KEYS.ROULETTES, roulettes);
    }

    function saveTotals() {
        setItemInStorage(LOCAL_STORAGE_KEYS.TOTALS, totals);
    }

    function saveHistory() {
        // 履歴上限チェックはここで行う方が一貫性があるかも
        if (history.length > HISTORY_LIMIT) {
            history = history.slice(0, HISTORY_LIMIT); // 上限を超えたら古いものから削除
        }
        setItemInStorage(LOCAL_STORAGE_KEYS.HISTORY, history);
    }

    // --- ★★★ 開発者ツールの表示制御 ★★★ ---
    function checkAndShowDeveloperTools() {
        // ハッシュが指定のものと一致するかどうかで表示を切り替える
        const shouldShow = window.location.hash === DEV_TOOLS_HASH;
        if (developerToolsSection) {
            developerToolsSection.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) {
                console.log('開発者ツールを表示しました。');
            }
        }
    }

    // --- ルーレットボタン関連 ---
    function initializeRouletteButtons() {
        rouletteButtons.innerHTML = ''; // ボタンエリアをクリア
        // 保存されているすべてのルーレット名に対してボタンを作成
        for (const name in roulettes) {
            createRouletteButton(name, name === currentRoulette);
        }

        // 現在のルーレットに対応するボタンに active クラスを付与
        const activeButton = rouletteButtons.querySelector(`.roulette-button[data-name="${currentRoulette}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        } else if (Object.keys(roulettes).length > 0) {
            // アクティブなボタンがない場合、最初のボタンをアクティブにする (フォールバック)
            const firstButton = rouletteButtons.querySelector('.roulette-button');
            if (firstButton) {
                currentRoulette = firstButton.dataset.name; // currentRoulette も更新
                firstButton.classList.add('active');
                // 状態を同期させるため、関連するUI更新も呼び出す
                loadCurrentRouletteConfig();
                createRouletteDisplay();
                toggleDeleteButtonVisibility();
            }
        }
    }

    function createRouletteButton(name, isActive = false) {
        // 既存ボタンチェックは不要 (initializeRouletteButtons でクリアしているため)
        const button = document.createElement('button');
        button.className = `roulette-button ${isActive ? 'active' : ''}`;
        button.textContent = name;
        button.dataset.name = name; // data属性にルーレット名を保持
        button.addEventListener('click', handleRouletteButtonClick); // クリックハンドラを統一
        rouletteButtons.appendChild(button);
        return button;
    }

    function handleRouletteButtonClick(event) {
        const clickedButton = event.currentTarget;
        const name = clickedButton.dataset.name;

        // すでにアクティブなら何もしない
        if (clickedButton.classList.contains('active')) {
            return;
        }

        // 他のボタンから active クラスを削除
        document.querySelectorAll('.roulette-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // クリックされたボタンに active クラスを追加
        clickedButton.classList.add('active');

        // 現在のルーレットを更新し、関連UIを再描画
        currentRoulette = name;
        loadCurrentRouletteConfig();
        createRouletteDisplay();
        toggleDeleteButtonVisibility(); // 削除ボタンの表示/非表示を切り替え
    }

    // --- 設定管理 (Config Management) ---

    // 現在のルーレット設定を読み込み、一時データ(currentConfigItems)に格納
    function loadCurrentRouletteConfig() {
        currentConfigItems = []; // 一時データをクリア
        const config = roulettes[currentRoulette] || {};
        for (const key in config) {
            const parsed = parseKeyString(key);
            const value = config[key];
            // 有効な形式 (例: +3日) かつ値が数値の場合のみ追加
            if (parsed && typeof value === 'number') {
                 currentConfigItems.push({ type: parsed.type, days: parsed.days, value });
            } else {
                console.warn(`Ignoring invalid config item in '${currentRoulette}': ${key}: ${value}`);
            }
        }
        // 項目リストのUI表示を更新
        renderItemList();
    }

    // currentConfigItems に基づいて項目リストのUIを生成
    function renderItemList() {
        itemList.innerHTML = ''; // リストをクリア
        currentConfigItems.forEach((item, index) => {
            const li = document.createElement('li');
            const typeSymbol = item.type === '+' ? '＋' : '－';
            const fullWidthDays = toFullWidth(item.days);
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

    // フォームから項目を currentConfigItems に追加
    function handleAddItem() {
        const type = itemTypeSelect.value;
        const days = parseInt(itemDaysInput.value, 10);
        const value = parseInt(itemValueInput.value, 10);

        // 入力値のバリデーション
        if (isNaN(days) || days < 0) {
            alert('日数は0以上の数値を入力してください。');
            return;
        }
        if (isNaN(value) || value <= 0) {
            alert('比率は1以上の数値を入力してください。');
            return;
        }

        // const keyString = `${type}${days}日`; // 作成はするが、重複チェックは update 時に行う

        // 一時データ (currentConfigItems) に追加
        currentConfigItems.push({ type, days, value });
        renderItemList(); // リストUIを更新

        // 入力フォームをクリア
        itemDaysInput.value = '';
        itemValueInput.value = '';
        itemTypeSelect.value = '+';
        itemDaysInput.focus();
    }

    // 項目リストから項目を削除 (currentConfigItems から削除)
    function handleDeleteItem(event) {
        // クリックされた要素が削除ボタンか確認
        if (event.target.classList.contains('delete-item-button')) {
            const index = parseInt(event.target.dataset.index, 10);
            // 有効なインデックスの場合のみ削除
            if (!isNaN(index) && index >= 0 && index < currentConfigItems.length) {
                currentConfigItems.splice(index, 1); // 配列から削除
                renderItemList(); // リストUIを更新
            }
        }
    }

    // currentConfigItems の内容で現在のルーレット設定を更新
    function handleUpdateRoulette() {
        // 1. バリデーション
        const validationError = validateConfigForUpdate(currentConfigItems);
        if (validationError) {
            alert(validationError);
            return;
        }

        // 2. 比率の合計を100%に調整 (必要であれば)
        const { adjustedItems, finalTotal, adjustmentMessage } = adjustRatiosTo100([...currentConfigItems]); // 元の配列を壊さないようコピーを渡す

        // 調整に関するメッセージがあれば表示
        if (adjustmentMessage) {
            alert(adjustmentMessage);
        }

        // 調整が不可能だった場合 (adjustedItems が null) や合計が不正な場合は中断
        if (!adjustedItems || finalTotal !== 100) {
            // adjustRatiosTo100 内で既にエラーメッセージは表示されているはず
            renderItemList(); // 調整が試みられた場合、表示を元に戻すか、調整後の表示にするか検討 (ここでは調整後を表示)
            return;
        }

        // 調整後のリストでUIを更新 (調整が行われた場合)
        if (adjustmentMessage && adjustmentMessage.includes('自動調整しました')) {
             currentConfigItems = adjustedItems; // グローバル変数も更新
             renderItemList(); // UIに反映
        }


        // 3. 設定オブジェクトの構築
        const newConfig = buildConfigFromItems(adjustedItems);

        // 4. 保存とUI更新
        roulettes[currentRoulette] = newConfig;
        saveRoulettes();
        createRouletteDisplay();
        alert(`ルーレット「${currentRoulette}」を更新しました。`);
    }

    // 設定更新前のバリデーション
    function validateConfigForUpdate(items) {
        if (items.length === 0) {
            return '少なくとも1つの項目が必要です。';
        }

        const keys = new Set();
        for (const item of items) {
            const keyString = `${item.type}${item.days}日`;
            if (keys.has(keyString)) {
                return `エラー: 同じ種類の項目（例: ${keyString}）が複数存在します。重複を解消してください。`;
            }
            keys.add(keyString);
        }

        return null; // エラーなし
    }

    // 比率の合計を計算し、必要なら100%に調整する
    function adjustRatiosTo100(items) {
        let totalValue = items.reduce((sum, item) => sum + item.value, 0);
        let adjustmentMessage = null; // ユーザーへの通知メッセージ

        if (totalValue === 100 || items.length === 0) {
            // 既に100%か、項目がない場合は調整不要
            return { adjustedItems: items, finalTotal: totalValue, adjustmentMessage };
        }

        // 合計が100でない場合、最後の項目で調整を試みる
        const lastItemIndex = items.length - 1;
        const lastItem = items[lastItemIndex];
        const lastItemKey = `${lastItem.type}${lastItem.days}日`;
        const difference = 100 - totalValue;
        const adjustedValue = lastItem.value + difference;

        if (adjustedValue <= 0) {
            // 調整しても0%以下になる場合はエラー
            adjustmentMessage = `エラー: 比率の合計が${totalValue}%です。最後の項目「${lastItemKey}」を調整しても比率が0%以下になってしまうため、合計100%にできません。各項目の比率を見直してください。`;
            return { adjustedItems: null, finalTotal: totalValue, adjustmentMessage }; // adjustedItems: null で失敗を示す
        }

        // 調整後の値を適用 (渡された配列のコピーを直接変更)
        items[lastItemIndex] = { ...lastItem, value: adjustedValue };
        totalValue = 100; // 合計を100に更新
        adjustmentMessage = `比率の合計が${totalValue - difference}%だったため、最後の項目「${lastItemKey}」の比率を${adjustedValue}％に自動調整しました。`;

        return { adjustedItems: items, finalTotal: totalValue, adjustmentMessage };
    }

    // currentConfigItems 配列から設定オブジェクトを構築
    function buildConfigFromItems(items) {
        const config = {};
        items.forEach(item => {
            const keyString = `${item.type}${item.days}日`;
            config[keyString] = item.value;
        });
        return config;
    }

    // 新しいルーレットを追加
    function handleAddRoulette() {
        const name = prompt('新しいルーレットの名前を入力してください：');
        if (!name || name.trim() === '') return; // キャンセルまたは空入力

        const trimmedName = name.trim();

        if (roulettes[trimmedName]) {
            alert('同じ名前のルーレットがすでに存在します');
            return;
        }

        // 新しいルーレットを空の設定で作成
        roulettes[trimmedName] = {};
        saveRoulettes();

        // 新しいボタンを追加
        const newButton = createRouletteButton(trimmedName, false); // 最初は非アクティブで作成

        // 新しいボタンをクリックしてアクティブにし、UIを更新
        newButton.click(); // clickイベントを発火させる

        alert(`新しいルーレット "${trimmedName}" を作成しました。項目を追加してください。`);
    }

    // 現在のルーレットを削除
    function handleDeleteRoulette() {
        if (currentRoulette === DEFAULT_ROULETTE_NAME) { // ★ 定数使用
            alert('デフォルトのルーレットは削除できません。');
            return;
        }

        if (!confirm(`本当に現在のルーレット「${currentRoulette}」を削除しますか？この操作は元に戻せません。`)) {
            return;
        }

        const buttonToRemove = document.querySelector(`.roulette-button[data-name="${currentRoulette}"]`);
        const nameToDelete = currentRoulette; // 削除する名前を保持

        // デフォルトルーレットに切り替え
        const defaultButton = document.querySelector(`.roulette-button[data-name="${DEFAULT_ROULETTE_NAME}"]`);
        if (defaultButton) {
            defaultButton.click(); // デフォルトボタンをクリックして状態を切り替える
        } else {
            // デフォルトボタンが見つからない場合のエラーハンドリング (通常は発生しないはず)
            console.error('Default roulette button not found during deletion.');
            // 強制的にデフォルトに設定し、UIをリロードするなどのフォールバックが必要かも
            currentRoulette = DEFAULT_ROULETTE_NAME;
            loadCurrentRouletteConfig();
            createRouletteDisplay();
            toggleDeleteButtonVisibility();
        }

        // データとボタンを削除
        delete roulettes[nameToDelete];
        if (buttonToRemove) {
            rouletteButtons.removeChild(buttonToRemove);
        }
        saveRoulettes();

        alert(`ルーレット「${nameToDelete}」を削除しました。`);
    }

    // 削除ボタンの表示/非表示を制御
    function toggleDeleteButtonVisibility() {
        // 現在のルーレットがデフォルトかどうかで表示を切り替え
        const isDefault = currentRoulette === DEFAULT_ROULETTE_NAME; // ★ 定数使用
        deleteRouletteButton.style.display = isDefault ? 'none' : 'block'; // 三項演算子で短縮
    }

    // --- 合計と履歴 (Totals & History) ---

    // 合計表示を更新
    function updateTotalsDisplay() {
        totalsElement.innerHTML = ''; // 表示をクリア
        let totalDaysSum = 0;

        // totals オブジェクトの内容に基づいて表示項目を作成
        for (const key in totals) {
            const count = totals[key] || 0; // 未定義の場合は0回とする
            const item = document.createElement('div');
            item.className = 'total-item';

            const parsedKey = parseKeyString(key);
            if (parsedKey) {
                // "+X日" または "-X日" 形式の場合
                const daysValue = parsedKey.days;
                const countValue = typeof count === 'number' ? count : 0;
                if (parsedKey.type === '+') {
                    totalDaysSum += daysValue * countValue;
                } else {
                    totalDaysSum -= daysValue * countValue;
                }
                const typeSymbol = parsedKey.type === '+' ? '＋' : '－';
                const fullWidthDays = toFullWidth(daysValue);
                item.textContent = `${typeSymbol}${fullWidthDays}日: ${countValue}回`;
            } else {
                // それ以外のキー (例: "禁酒継続") の場合
                item.textContent = `${key}: ${count}回`;
            }
            totalsElement.appendChild(item);
        }

        // 合計日数を計算して表示
        const sumPrefix = totalDaysSum >= 0 ? '＋' : '－';
        const absSumDays = Math.abs(totalDaysSum);
        const fullWidthSumDays = toFullWidth(absSumDays);
        // 見出し横のspan要素にテキストを設定
        totalDaysSummarySpan.textContent = `：${sumPrefix}${fullWidthSumDays}日`;
    }

    // 履歴表示を更新
    function updateHistoryDisplay() {
        historyList.innerHTML = ''; // 表示をクリア
        // history 配列の内容に基づいてリスト項目を作成
        history.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.time}: ${item.result}`; // 時刻と結果を表示
            historyList.appendChild(li);
        });
        // 履歴コンテナの表示状態を制御（例: 履歴がなければ非表示にするなど、必要なら）
        // const historyContainer = historyList.closest('.history-container');
        // if (historyContainer) {
        //     historyContainer.style.display = history.length > 0 ? 'block' : 'none';
        // }
    }

    // 合計リセット処理
    function handleResetTotals() {
        if (!confirm('本当に合計をリセットしますか？この操作は元に戻せません。')) {
            return;
        }

        // 履歴にリセット操作を記録
        const timestamp = new Date().toLocaleString();
        history.unshift({ time: timestamp, result: '合計をリセットしました' });
        // saveHistory() は履歴上限チェックも行うので、ここで呼ぶ
        saveHistory();
        updateHistoryDisplay(); // 履歴表示を更新

        // totals を空にして保存
        totals = {};
        saveTotals();
        updateTotalsDisplay(); // 合計表示を更新 (空になる)

        alert('合計をリセットしました。');
    }

    // --- ルーレット回転 (Spinning Logic) ---
    // ★★★ リファクタリング前の spinRoulette 関数に戻す ★★★
    async function spinRoulette() {
        if (spinning) return;
        spinning = true;
        spinButton.disabled = true;
        resultElement.textContent = '-'; // 結果表示をリセット

        // --- 1. 現在角度取得とリセット ---
        const currentAngleCCW = getRotationDegrees(rouletteInner);
        const resetAngleCss = currentAngleCCW % 360; // 360度剰余でリセット後の角度を決定

        rouletteInner.style.transition = 'none'; // アニメーションを一時停止
        rouletteInner.style.transform = `rotate(${resetAngleCss}deg)`; // 角度をリセット

        // ブラウザの再描画を待機 (requestAnimationFrame を2回使う)
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));

        // --- 2. 目標角度計算 ---
        const config = roulettes[currentRoulette];
        if (!config || Object.keys(config).length === 0) {
            alert('ルーレット設定が空です。回転できません。');
            // ★★★ 状態リセットを追加 ★★★
            spinning = false;
            spinButton.disabled = false;
            return;
        }

        // 設定から項目リストと確率を生成
        const items = [];
        let totalValue = 0;
        for (const key in config) {
            const value = config[key];
            if (typeof value === 'number' && value > 0) {
                items.push({ key, value });
                totalValue += value;
            }
        }

        if (items.length === 0 || totalValue <= 0) {
            alert('有効なルーレット項目がありません。');
            // ★★★ 状態リセットを追加 ★★★
            spinning = false;
            spinButton.disabled = false;
            return;
        }

        // 確率に基づいて結果を決定
        const resultItem = determineResult(items, totalValue);
        const resultKey = resultItem.key;

        // 結果に対応するセクション要素を取得
        const resultSection = rouletteInner.querySelector(`.roulette-section[data-item="${resultKey}"]`);
        if (!resultSection) {
            console.error(`Result section not found for key: ${resultKey}`);
            // ★★★ 状態リセットを追加 ★★★
            spinning = false;
            spinButton.disabled = false;
            return;
        }

        // 目標角度を計算
        const startAngle = parseFloat(resultSection.dataset.startAngle);
        const endAngle = parseFloat(resultSection.dataset.endAngle);
        // セクションの中央を狙う
        const middleAngle = startAngle + (calculateAngleDifference(startAngle, endAngle) / 2);
        // マーカー位置(270度)にセクション中央が来るような回転角度を計算
        const targetRotationOffset = (MARKER_POSITION_DEG - middleAngle + 360) % 360;
        // 停止位置にわずかなランダム性を加える (±5度程度)
        const randomOffset = (Math.random() - 0.5) * 10;
        // 最終的な停止角度 (0-360度、時計回り)
        const finalTargetAngleCW = (targetRotationOffset + randomOffset + 360) % 360;
        // CSSのrotateは反時計回りが正なので、負の値にする
        const finalTargetAngleCCW = -finalTargetAngleCW;

        // 最低回転数を加味した最終的なCSS角度
        const animationFinalCssAngle = finalTargetAngleCCW + BASE_ROTATION_DEG; // ★ 定数使用

        // --- 3. アニメーション開始 ---
        rouletteInner.style.transition = `transform ${SPIN_DURATION_MS / 1000}s cubic-bezier(0.2, 0.1, 0.25, 1.0)`; // ★ 定数使用
        rouletteInner.style.transform = `rotate(${animationFinalCssAngle}deg)`;

        // --- 4. アニメーション終了後の処理 ---
        setTimeout(() => {
            handleSpinEnd(resultKey); // 結果処理を別関数に委譲
        }, SPIN_DURATION_MS); // ★ 定数使用
    }

    // スピン終了後の処理 (結果表示、データ更新、UI更新)
    function handleSpinEnd(determinedResultKey) {
        const actualRotation = getRotationDegrees(rouletteInner);
        // CSSの回転角度(反時計回り)から、マーカーが指すルーレット盤上の角度(時計回り)を計算
        const svgRotation = (-actualRotation % 360 + 360) % 360;
        const markerPointsToAngle = (MARKER_POSITION_DEG - svgRotation + 360) % 360;

        // 実際にマーカーが指しているセクションを確認 (デバッグ/検証用)
        let actualResultKey = null;
        const sections = rouletteInner.querySelectorAll('.roulette-section');
            for (const section of sections) {
                const secStart = parseFloat(section.dataset.startAngle);
                const secEnd = parseFloat(section.dataset.endAngle);
            if (isAngleBetween(markerPointsToAngle, secStart, secEnd)) {
                actualResultKey = section.dataset.item;
                    break;
                }
            }

        // 決定論的な結果と実際の停止位置が異なる場合、コンソールに警告 (通常は一致するはず)
        if (actualResultKey !== determinedResultKey) {
            console.warn(`Spin result mismatch: Determined=${determinedResultKey}, Actual=${actualResultKey}. Using determined result.`);
            // デバッグ用に実際の角度も表示
            console.log(`Marker points to: ${markerPointsToAngle.toFixed(2)}deg, SVG rotation: ${svgRotation.toFixed(2)}deg`);
        }
        const finalResultKey = determinedResultKey; // 決定論的な結果を採用

        // 結果を表示
        resultElement.textContent = finalResultKey;

        // ラベルの回転補正 (現在の回転角度の逆を適用)
        const compensatingRotationCSS = -actualRotation;
        rouletteInner.querySelectorAll('.section-label').forEach(label => {
            label.style.transform = `translate(-50%, -50%) rotate(${compensatingRotationCSS}deg)`;
        });

        // 合計を更新
        if (!totals[finalResultKey]) {
            totals[finalResultKey] = 0;
        }
        totals[finalResultKey]++;
            saveTotals();
            updateTotalsDisplay();

        // 履歴に追加
            const timestamp = new Date().toLocaleString();
        history.unshift({ time: timestamp, result: finalResultKey });
        saveHistory(); // saveHistory内で上限チェックと保存を行う
            updateHistoryDisplay();

        // スピン状態を解除
            spinning = false;
            spinButton.disabled = false;
    }

    // 結果を確率に基づいて決定する関数
    function determineResult(items, totalValue) {
        const randomValue = Math.random() * totalValue; // 0 から totalValue の間の乱数
        let cumulativeValue = 0;

        for (const item of items) {
            cumulativeValue += item.value;
            if (randomValue < cumulativeValue) {
                return item; // 当選
            }
        }

        // フォールバック (通常は発生しないが、浮動小数点誤差などで到達する可能性)
        console.warn("Fallback in determineResult, returning last item.");
        return items[items.length - 1];
    }


    // --- ルーレット表示作成 (Roulette Display Creation) ---
    // TODO: createRouletteDisplay 関数を分割してリファクタリングする
    function createRouletteDisplay() {
        // トランジションを一時的に無効化して再描画時のアニメーションを防ぐ
        const originalTransition = rouletteInner.style.transition;
        rouletteInner.style.transition = 'none';

        const config = roulettes[currentRoulette];
        rouletteInner.innerHTML = ''; // 表示をクリア

        // 設定がない、または空の場合はメッセージ表示
        if (!config || Object.keys(config).length === 0) {
            rouletteInner.innerHTML = '<div class="roulette-message">設定が空です</div>';
            // 念のためトランジションを戻す (すぐにreturnする場合)
            // requestAnimationFrame(() => rouletteInner.style.transition = originalTransition);
            return;
        }

        // 設定値の合計を計算
        let totalValue = 0;
        const validItems = []; // 有効な項目のみを格納
        for (const key in config) {
            const value = config[key];
            if (typeof value === 'number' && value > 0) {
                totalValue += value;
                validItems.push({ key, value });
            }
        }

        // 有効な項目がない場合はメッセージ表示
        if (totalValue <= 0) {
            rouletteInner.innerHTML = '<div class="roulette-message">有効な設定値がありません</div>';
            // requestAnimationFrame(() => rouletteInner.style.transition = originalTransition);
            return;
        }

        // 角度をリセット (トランジション無効中に行う)
        rouletteInner.style.transform = 'rotate(0deg)';

        // 扇形とラベルを作成して追加
        let cumulativeAngle = 0;
        validItems.forEach((item, index) => {
            const { key, value } = item;
            const sectionAngle = (value / totalValue) * 360;
            const percentage = (value / totalValue) * 100;
            const color = COLORS[index % COLORS.length]; // ★ 定数使用

            const startAngle = cumulativeAngle;
            const endAngle = startAngle + sectionAngle;

            // 扇形のコンテナdivを作成
            const section = document.createElement('div');
            section.className = 'roulette-section';
            // データ属性に情報を格納
            section.dataset.item = key;
            section.dataset.startAngle = startAngle.toFixed(4); // 精度を少し上げる
            section.dataset.endAngle = endAngle.toFixed(4);
            // section.dataset.probability = percentage.toFixed(2); // 必要なら

            // SVG要素と扇形パスを作成
            const svg = createSectionSVG(startAngle, endAngle, color);
            section.appendChild(svg);

            // ラベル要素を作成
            const label = createSectionLabel(key, percentage, startAngle, sectionAngle);
            section.appendChild(label);

            rouletteInner.appendChild(section);

            cumulativeAngle = endAngle; // 次の開始角度を更新
        });

        // トランジションを元に戻す (次のフレームで)
        // spinRoulette 内で設定するため、ここでは不要かも
        // requestAnimationFrame(() => {
        //     rouletteInner.style.transition = originalTransition;
        // });
    }

     // 扇形のSVG要素を作成するヘルパー関数
    function createSectionSVG(startAngle, endAngle, color) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.position = 'absolute'; // SVG自体を絶対配置に
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.top = '0';
        svg.style.left = '0';

        const cx = 50, cy = 50, radius = 50;
        const startRad = startAngle * Math.PI / 180;
        const endRad = endAngle * Math.PI / 180;

        const startX = cx + radius * Math.cos(startRad);
        const startY = cy + radius * Math.sin(startRad);
        const endX = cx + radius * Math.cos(endRad);
        const endY = cy + radius * Math.sin(endRad);

        const sectionAngle = calculateAngleDifference(startAngle, endAngle); // 角度差を計算
        const largeArcFlag = sectionAngle > 180 ? 1 : 0;
        // ほぼ360度の場合の描画崩れ対策 (わずかに小さくする)
        const sweepFlag = (endAngle - startAngle >= 359.99) ? 0 : 1;

        // M 中心 L 開始点 A 円弧終点 Z 閉じる
        const d = `M ${cx} ${cy} L ${startX.toFixed(4)} ${startY.toFixed(4)} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX.toFixed(4)} ${endY.toFixed(4)} Z`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', color);
        // path.setAttribute('stroke', '#fff'); // 境界線が必要な場合
        // path.setAttribute('stroke-width', '0.2');

        svg.appendChild(path);
        return svg;
    }

    // セクションラベルのDIV要素を作成するヘルパー関数
    function createSectionLabel(key, percentage, startAngle, sectionAngle) {
        const label = document.createElement('div');
        label.className = 'section-label';
        label.textContent = `${key} (${percentage.toFixed(1)}%)`;

        // ラベルの位置を計算 (セクションの中央、半径の70% or 50%の位置)
        const labelAngle = startAngle + sectionAngle / 2;
        const radiusRatio = sectionAngle < 20 ? 0.5 : 0.7; // 小さいセクションは内側に
        const cx = 50, cy = 50; // 中心座標 (パーセント)
        const labelRadius = 50 * radiusRatio; // 親要素(roulette-inner)に対する半径

        const labelX = cx + labelRadius * Math.cos(labelAngle * Math.PI / 180);
        const labelY = cy + labelRadius * Math.sin(labelAngle * Math.PI / 180);

        label.style.position = 'absolute';
        label.style.left = `${labelX.toFixed(2)}%`;
        label.style.top = `${labelY.toFixed(2)}%`;
        // transform で中央揃え + 回転補正 (回転補正は spinEnd で行う)
        label.style.transform = 'translate(-50%, -50%)';
        // label.style.transformOrigin = 'center center'; // 回転基点

        // フォントサイズなどを調整
        label.style.fontSize = sectionAngle < 15 ? '14px' : (sectionAngle < 30 ? '16px' : '18px'); // より細かく調整
        // その他スタイル (CSSで定義する方が望ましい場合もある)
        label.style.color = 'white';
        label.style.fontWeight = 'bold';
        label.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
        label.style.whiteSpace = 'nowrap'; // 改行を防ぐ
        label.style.pointerEvents = 'none'; // ラベルがクリックイベントを妨げないように

        return label;
    }

    // --- ヘルパー関数 (Helpers) ---

    // 半角数字を全角数字に変換
    function toFullWidth(str) {
        return String(str).replace(/[0-9]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
        });
    }

    // "+X日" または "-X日" 形式のキー文字列をパース
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

    // 要素の現在のCSS transformによる回転角度を取得 (反時計回りを正とする)
    function getRotationDegrees(element) {
        try {
            const style = window.getComputedStyle(element);
            const transform = style.transform || style.webkitTransform || style.mozTransform;

            if (transform === 'none' || !transform.includes('matrix')) {
                return 0;
            }
            // matrix(a, b, c, d, tx, ty)
            const values = transform.split('(')[1].split(')')[0].split(',');
            const a = parseFloat(values[0]);
            const b = parseFloat(values[1]);
            // atan2(b, a) はラジアン単位の角度を返す (-PI から PI)
            const angleRad = Math.atan2(b, a);
            // 度に変換し、CSSの回転方向（反時計回りが正）に合わせる
            const angleDeg = angleRad * (180 / Math.PI);
            // return Math.round(angleDeg); // 四捨五入
            return angleDeg; // より正確な値を返す
        } catch (e) {
            console.error("Error getting rotation degrees:", e);
            return 0; // エラー時は0を返す
        }
    }

    // 角度が指定された範囲内にあるかチェック (0/360度境界対応)
    function isAngleBetween(angle, start, end) {
        // 角度を 0 <= x < 360 の範囲に正規化
        angle = (angle % 360 + 360) % 360;
        start = (start % 360 + 360) % 360;
        end = (end % 360 + 360) % 360;

        // 角度差を考慮して、endがstartより小さい場合（0度をまたぐ場合）に対応
        if (start <= end) {
            // 通常の範囲 (例: start=10, end=50)
            // 終了角度を含むように <= とする
            return angle >= start && angle <= end;
        } else {
            // 0度をまたぐ範囲 (例: start=350, end=20)
            // start以上 または end以下
            return angle >= start || angle <= end;
        }
    }

    // 2つの角度間の差を計算 (常に正の値、時計回り)
    function calculateAngleDifference(startAngle, endAngle) {
        let diff = (endAngle - startAngle) % 360;
        if (diff < 0) {
            diff += 360; // 常に正の値にする
        }
        // ほぼ0度差の場合や完全な円の場合を考慮
        if (diff < 0.0001 && Math.abs(endAngle - startAngle) >= 359.999) {
            return 360;
        }
        return diff === 0 ? 360 : diff; // 差が0の場合は360度とする（完全な円）
    }

    // --- 完全リセット処理 ---
    function handleFullReset() {
        if (!confirm('本当に全てのローカルストレージデータを削除し、初期状態に戻しますか？\nこの操作は元に戻せません。（開発用）')) {
            return;
        }
        try {
            localStorage.clear();
            alert('ローカルストレージをクリアしました。ページをリロードします。');
            location.reload(); // ページをリロードして初期化
        } catch (error) {
            console.error('完全リセット処理中にエラーが発生しました:', error);
            alert('完全リセットに失敗しました。\n' + error);
        }
    }

}); // End of DOMContentLoaded 