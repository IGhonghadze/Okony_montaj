// =======================================================
// Оконный Монтаж — Логика калькулятора (v3.0)
// =======================================================

let ITEMS = [];
let CURRENT_ORDER_NAME = "Текущий заказ";

// База цен по умолчанию (теперь только для москитных сеток)
let PRICES = {
    nets: {
        "Оконная стандарт": { r_less: 900, r_more: 1100, d_less: 650, d_more: 800 },
        "Оконная Антрацит": { r_less: 2000, r_more: 2300, d_less: 1600, d_more: 1100 },
        "Сетки VSN": { r_less: 2200, r_more: 2700, d_less: 1600, d_more: 2000 },
        "Дверная 32 профиль": { r_less: 2700, r_more: 2700, d_less: 2000, d_more: 2000 },
        "Дверная 42 профиль": { r_less: 3200, r_more: 3200, d_less: 2200, d_more: 2200 },
        "Дверная 52 профиль": { r_less: 5000, r_more: 5000, d_less: 4500, d_more: 4500 },
        "Сетка под роллет": { r_less: 2000, r_more: 2000, d_less: 1200, d_more: 1200 },
        "Сетка плиссе": { r_less: 5200, r_more: 5200, d_less: 3800, d_more: 3800 }
    }
};

window.onload = async function() {
    lucide.createIcons();
    loadPricesFromStorage();
    await tryAutoConnectDb();
};

function loadPricesFromStorage() {
    let stored = localStorage.getItem('OKON_PRICES');
    if (stored) {
        try {
            let parsed = JSON.parse(stored);
            if(parsed.nets) PRICES.nets = parsed.nets; // Загружаем только сетки
            document.getElementById('price-status').innerText = 'Пользовательский';
            document.getElementById('price-status-text').innerText = 'Загружен свой прайс';
        } catch(e) {
            console.error("Ошибка загрузки сохраненного прайса", e);
        }
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.category-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
}

// ==========================================
// 1. ДОБАВЛЕНИЕ ТОВАРОВ
// ==========================================
function addNet() {
    let sys = document.getElementById('net-system').value;
    let col = document.getElementById('net-color').value;
    let wIn = parseFloat(document.getElementById('net-w').value);
    let hIn = parseFloat(document.getElementById('net-h').value);
    let zamer = document.getElementById('net-zamer').value;
    let fabric = document.getElementById('net-fabric').value;
    let corners = document.getElementById('net-corners').checked;
    let montage = document.getElementById('net-montage').checked;

    if (!wIn || !hIn) { alert("Укажите ширину и высоту!"); return; }

    let priceKey = sys;
    if (sys === "Оконная") {
        priceKey = col === "Антрацит" ? "Оконная Антрацит" : "Оконная стандарт";
    }

    let w = wIn, h = hIn;
    let desc = [];

    if (zamer === "световой") {
        if (priceKey.includes("стандарт") || priceKey.includes("Антрацит") || sys.includes("роллет")) { w += 50; h += 50; }
        else if (sys === "Дверная 32 профиль") { w += 64; h += 64; }
        else if (sys === "Дверная 42 профиль") { w += 84; h += 84; }
        else { desc.push("Без припусков (готовый размер)"); }
    }

    let sqM = (w / 1000) * (h / 1000);
    let linM = ((w / 1000) + (h / 1000)) * 2;
    let cR = 0, cD = 0;

    if (sys === "Дверная 52 профиль") {
        cR = sqM <= 1.68 ? 5500 : 6000;
        cD = sqM <= 1.68 ? 4500 : 5000;
        if (linM > 5.8) { cR += 500; cD += 500; desc.push("Наценка за хлыст"); }
    } else {
        let p = PRICES.nets[priceKey] || { r_less: 0, r_more: 0, d_less: 0, d_more: 0 };
        if (sqM <= 0.8) {
            if (priceKey.includes("стандарт") || priceKey.includes("Антрацит") || sys === "Сетки VSN") {
                cR = p.r_less; cD = p.d_less;
            } else {
                cR = sqM * p.r_less; cD = sqM * p.d_less;
            }
        } else {
            cR = sqM * p.r_more; cD = sqM * p.d_more;
        }
    }

    if (fabric !== "стандарт") {
        cR += Math.max(800, sqM * 1000);
        cD += Math.max(640, sqM * 800);
        desc.push(`Полотно: ${fabric}`);
    }
    if (corners) { cR += 200; cD += 150; desc.push("Уголки"); }
    
    let mCost = 0;
    if (montage) {
        mCost = sys.includes("Дверная") || sys.includes("плиссе") ? 1000 : 500;
        desc.push(`Монтаж (${mCost} ₽)`);
    }

    ITEMS.push({
        id: Date.now(), 
        type: 'net',
        title: `${sys} (${col})`, 
        qty: 1, 
        retail: Math.round(cR + mCost), 
        dealer: Math.round(cD),
        montageCost: mCost,
        text: `Размер: ${w}х${h} мм | Площадь: ${sqM.toFixed(3)} м²`,
        opts: desc.join(" | "),
        sqM: sqM,
        linM: 0
    });
    
    document.getElementById('net-w').value = '';
    document.getElementById('net-h').value = '';
    document.getElementById('net-w').focus();
    renderCart();
}

function addSill() {
    let dIn = parseFloat(document.getElementById('sill-d').value);
    let lIn = parseFloat(document.getElementById('sill-l').value);
    let col = document.getElementById('sill-color').value;
    let caps = document.getElementById('sill-caps').value;
    let qty = parseInt(document.getElementById('sill-qty').value) || 1;

    if (!dIn || !lIn) { alert("Заполните глубину и длину подоконника!"); return; }

    let lM = lIn / 1000;
    let desc = [];
    if (caps !== "Без заглушек") desc.push("Пара заглушек");

    // Подоконники теперь только для погонажа, без цены
    ITEMS.push({
        id: Date.now(), 
        type: 'sill',
        title: `Подоконник (${col})`, 
        qty: qty, 
        retail: 0, dealer: 0,
        text: `Глубина: ${dIn} мм, Длина: ${lIn} мм`,
        opts: desc.join(" | "),
        sqM: 0,
        linM: lM,
        depth: dIn
    });
    
    document.getElementById('sill-d').value = '';
    document.getElementById('sill-l').value = '';
    document.getElementById('sill-qty').value = '1';
    document.getElementById('sill-d').focus();
    renderCart();
}

function addSandwich() {
    let col = document.getElementById('sand-color').value;
    let wIn = parseFloat(document.getElementById('sand-w').value);
    let hIn = parseFloat(document.getElementById('sand-h').value);
    let thick = document.getElementById('sand-thick').value;
    let qty = parseInt(document.getElementById('sand-qty').value) || 1;

    if (!wIn || !hIn) { alert("Заполните ширину и высоту панели!"); return; }

    let sqM = (wIn / 1000) * (hIn / 1000);

    // Сэндвич теперь только для квадратуры, без цены
    ITEMS.push({
        id: Date.now(), 
        type: 'sand',
        title: `Сэндвич-панель ${thick}`, 
        qty: qty, 
        retail: 0, dealer: 0,
        text: `Размеры: ${wIn}х${hIn} мм | Цвет: ${col} | Площадь: ${sqM.toFixed(3)} м²`,
        opts: "",
        sqM: sqM,
        linM: 0
    });
    
    document.getElementById('sand-w').value = '';
    document.getElementById('sand-h').value = '';
    document.getElementById('sand-qty').value = '1';
    document.getElementById('sand-w').focus();
    renderCart();
}

function addEbb() {
    let dIn = parseFloat(document.getElementById('ebb-d').value);
    let lIn = parseFloat(document.getElementById('ebb-l').value);
    let qty = parseInt(document.getElementById('ebb-qty').value) || 1;

    if (!dIn || !lIn) { alert("Заполните глубину и длину отлива!"); return; }

    let lM = lIn / 1000;

    // Отливы теперь только для погонажа, без цены
    ITEMS.push({
        id: Date.now(), 
        type: 'ebb',
        title: `Отлив`, 
        qty: qty, 
        retail: 0, dealer: 0,
        text: `Глубина: ${dIn} мм, Длина: ${lIn} мм`,
        opts: "",
        sqM: 0,
        linM: lM,
        depth: dIn
    });
    
    document.getElementById('ebb-d').value = '';
    document.getElementById('ebb-l').value = '';
    document.getElementById('ebb-qty').value = '1';
    document.getElementById('ebb-d').focus();
    renderCart();
}

function addProfile() {
    let type = document.getElementById('prof-type').value;
    let dIn = parseFloat(document.getElementById('prof-d').value);
    let lIn = parseFloat(document.getElementById('prof-l').value);
    let qty = parseInt(document.getElementById('prof-qty').value) || 1;

    if (!dIn || !lIn) { alert("Заполните глубину и длину профиля!"); return; }

    let lM = lIn / 1000;

    // Профиля теперь только для погонажа, без цены
    ITEMS.push({
        id: Date.now(), 
        type: 'prof',
        title: type, 
        qty: qty, 
        retail: 0, dealer: 0,
        text: `Глубина: ${dIn} мм, Длина: ${lIn} мм`,
        opts: "",
        sqM: 0,
        linM: lM
    });
    
    document.getElementById('prof-d').value = '';
    document.getElementById('prof-l').value = '';
    document.getElementById('prof-qty').value = '1';
    document.getElementById('prof-d').focus();
    renderCart();
}

// ==========================================
// ОТРИСОВКА КОРЗИНЫ И РЕДАКТИРОВАНИЕ
// ==========================================
function updateQty(id, diff) {
    let item = ITEMS.find(i => i.id === id);
    if (item) {
        item.qty += diff;
        if (item.qty < 1) item.qty = 1;
        renderCart();
    }
}

function removeItem(id) { 
    ITEMS = ITEMS.filter(i => i.id !== id); 
    renderCart(); 
}

function clearCart() { 
    ITEMS = []; 
    CURRENT_ORDER_NAME = "Новый заказ";
    document.getElementById('print-order-name').innerText = CURRENT_ORDER_NAME;
    document.getElementById('global-markup').value = "0";
    renderCart(); 
}

function renderCart() {
    let list = document.getElementById('cart-items');
    list.innerHTML = "";
    
    let globalMarkupPercent = parseInt(document.getElementById('global-markup').value) || 0;
    let markupFactor = 1 + (globalMarkupPercent / 100);

    let totalR = 0, totalD = 0;
    let sumLinM = 0, sumSqM = 0;
    
    let breakdown = { sill: {}, ebb: {}, prof: 0, net: 0, sand: 0 };

    if (ITEMS.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-400 py-12 flex flex-col items-center gap-2"><i data-lucide="package-open" class="w-12 h-12 text-slate-200"></i><span>Смета пуста. Заполните конфигуратор.</span></div>`;
        document.getElementById('cart-total').innerText = '0 ₽';
        document.getElementById('cart-summaries').classList.add('hidden');
        lucide.createIcons();
        return;
    }

    document.getElementById('cart-summaries').classList.remove('hidden');

    ITEMS.forEach((it, i) => {
        let finalRetail = it.type === 'net'
            ? Math.round(it.dealer * markupFactor) + (it.montageCost !== undefined ? it.montageCost : (it.opts && it.opts.includes("Монтаж") ? (it.title.includes("Дверная") || it.title.includes("плиссе") ? 1000 : 500) : 0))
            : Math.round(it.retail * markupFactor);
        let itemRetailSum = finalRetail * it.qty;
        let itemDealerSum = it.dealer * it.qty;
        
        totalR += itemRetailSum;
        totalD += itemDealerSum;

        if(it.linM) {
            let addL = it.linM * it.qty;
            sumLinM += addL;
            if(it.type === 'sill') {
                let d = it.depth || 'Неизв.';
                breakdown.sill[d] = (breakdown.sill[d] || 0) + addL;
            } else if(it.type === 'ebb') {
                let d = it.depth || 'Неизв.';
                breakdown.ebb[d] = (breakdown.ebb[d] || 0) + addL;
            } else if(it.type === 'prof') {
                breakdown.prof += addL;
            }
        }
        if(it.sqM) {
            let addS = it.sqM * it.qty;
            sumSqM += addS;
            if(it.type) breakdown[it.type] += addS;
        }
        
        let priceStr = finalRetail > 0 
            ? `<div class="text-right font-black text-brand-primary text-lg whitespace-nowrap">${itemRetailSum.toLocaleString()} ₽ <div class="text-xs text-slate-400 font-medium">(${finalRetail.toLocaleString()} ₽/шт)</div></div>`
            : ``; // Оставляем пустым для позиций без цены
        
        list.innerHTML += `
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group hover:border-brand-primary transition-all cart-item-print">
                
                <div class="absolute top-3 right-3 flex gap-2 no-print">
                    <button onclick="removeItem(${it.id})" class="text-slate-300 hover:text-red-500 transition-colors bg-slate-50 p-1.5 rounded-lg del-btn" title="Удалить"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                
                <div class="font-bold text-slate-800 pr-16 mb-1">${i+1}. ${it.title}</div>
                <div class="text-sm text-slate-500 leading-snug w-full md:w-3/4">${it.text}</div>
                ${it.opts ? `<div class="text-xs text-brand-primary mt-1 font-medium">${it.opts}</div>` : ''}
                
                <div class="mt-3 flex justify-between items-end">
                    <div class="flex items-center gap-2 no-print bg-slate-100 p-1 rounded-lg">
                        <button onclick="updateQty(${it.id}, -1)" class="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-md shadow-sm hover:bg-slate-200">-</button>
                        <span class="w-6 text-center font-bold text-sm text-slate-700">${it.qty}</span>
                        <button onclick="updateQty(${it.id}, 1)" class="w-7 h-7 flex items-center justify-center bg-white text-slate-600 rounded-md shadow-sm hover:bg-slate-200">+</button>
                    </div>
                    <div class="hidden print-only font-bold text-slate-700">Кол-во: ${it.qty} шт</div>
                    ${priceStr}
                </div>
            </div>`;
    });

    document.getElementById('cart-total').innerText = totalR.toLocaleString() + ' ₽';
    document.getElementById('sum-lin').innerText = sumLinM.toFixed(2) + ' п.м.';
    document.getElementById('sum-sq').innerText = sumSqM.toFixed(3) + ' м²';
    
    let sillStrs = Object.keys(breakdown.sill).map(d => `${d}мм: ${breakdown.sill[d].toFixed(2)} п.м.`).join(', ');
    let sillText = sillStrs ? `Подоконники (${sillStrs})` : `Подоконники: 0 п.м.`;

    let ebbStrs = Object.keys(breakdown.ebb).map(d => `${d}мм: ${breakdown.ebb[d].toFixed(2)} п.м.`).join(', ');
    let ebbText = ebbStrs ? `Отливы (${ebbStrs})` : `Отливы: 0 п.м.`;

    // Обновляем детализацию
    document.getElementById('sum-lin-breakdown').innerText = `(${sillText} | ${ebbText} | Профиля: ${breakdown.prof.toFixed(2)} п.м.)`;
    document.getElementById('sum-sq-breakdown').innerText = `(Сетки: ${breakdown.net.toFixed(3)} м² | Сэндвич: ${breakdown.sand.toFixed(3)} м²)`;
    
    lucide.createIcons();
}

// ==========================================
// АРХИВ ЗАКАЗОВ (LOCAL STORAGE + BACKUP)
// ==========================================
function getArchive() {
    let data = localStorage.getItem('ARCHIVED_ORDERS');
    return data ? JSON.parse(data) : [];
}

function saveOrderToArchive() {
    if (ITEMS.length === 0) {
        alert("Смета пуста! Заполните корзину.");
        return;
    }
    let name = prompt("Введите название заказа (Например, 'Ул. Ленина 42'):", CURRENT_ORDER_NAME !== "Текущий заказ" ? CURRENT_ORDER_NAME : "");
    if (!name || name.trim() === "") return;
    
    let markup = document.getElementById('global-markup').value;
    let archive = getArchive();
    
    let totalR = 0;
    let markupFactor = 1 + (parseInt(markup) / 100);
    ITEMS.forEach(it => {
        let finalRetail = it.type === 'net'
            ? Math.round(it.dealer * markupFactor) + (it.montageCost !== undefined ? it.montageCost : (it.opts && it.opts.includes("Монтаж") ? (it.title.includes("Дверная") || it.title.includes("плиссе") ? 1000 : 500) : 0))
            : Math.round(it.retail * markupFactor);
        totalR += finalRetail * it.qty;
    });

    let newOrder = {
        id: Date.now().toString(),
        name: name,
        date: new Date().toLocaleString('ru-RU'),
        items: JSON.parse(JSON.stringify(ITEMS)),
        markup: markup,
        total: totalR
    };

    archive.push(newOrder);
    localStorage.setItem('ARCHIVED_ORDERS', JSON.stringify(archive));
    
    CURRENT_ORDER_NAME = name;
    document.getElementById('print-order-name').innerText = CURRENT_ORDER_NAME;
    alert(`Заказ «${name}» успешно сохранен в браузере!`);
}

function openArchiveModal() {
    let archive = getArchive();
    let list = document.getElementById('archive-list');
    list.innerHTML = "";
    
    if (archive.length === 0) {
        list.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Архив пуст</td></tr>`;
    } else {
        archive.sort((a,b) => b.id - a.id).forEach(order => {
            list.innerHTML += `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td class="p-3 font-bold text-brand-dark">${order.name}</td>
                    <td class="p-3 text-slate-500 text-xs">${order.date}</td>
                    <td class="p-3 text-right font-bold text-brand-primary whitespace-nowrap">${order.total.toLocaleString()} ₽</td>
                    <td class="p-3 text-center">
                        <button onclick="loadOrder('${order.id}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold mr-2 transition-colors">Загрузить</button>
                        <button onclick="deleteOrder('${order.id}')" class="text-red-400 hover:text-red-600 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </td>
                </tr>
            `;
        });
    }
    
    let modal = document.getElementById('archive-modal');
    let content = document.getElementById('archive-modal-content');
    modal.classList.remove('opacity-0', 'invisible');
    content.classList.remove('scale-95');
    lucide.createIcons();
}

function closeArchiveModal() {
    let modal = document.getElementById('archive-modal');
    let content = document.getElementById('archive-modal-content');
    modal.classList.add('opacity-0', 'invisible');
    content.classList.add('scale-95');
}

function loadOrder(id) {
    let archive = getArchive();
    let order = archive.find(o => o.id === id);
    if (order) {
        ITEMS = JSON.parse(JSON.stringify(order.items));
        document.getElementById('global-markup').value = order.markup || "0";
        CURRENT_ORDER_NAME = order.name;
        document.getElementById('print-order-name').innerText = CURRENT_ORDER_NAME;
        renderCart();
        closeArchiveModal();
    }
}

function deleteOrder(id) {
    if(confirm("Точно удалить этот заказ из архива?")) {
        let archive = getArchive().filter(o => o.id !== id);
        localStorage.setItem('ARCHIVED_ORDERS', JSON.stringify(archive));
        openArchiveModal();
    }
}

function exportArchiveJSON() {
    let data = localStorage.getItem('ARCHIVED_ORDERS') || "[]";
    let blob = new Blob([data], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `Резервная_копия_Архив_${new Date().toLocaleDateString('ru-RU')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importArchiveJSON(event) {
    let file = event.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let imported = JSON.parse(e.target.result);
            if(Array.isArray(imported)) {
                localStorage.setItem('ARCHIVED_ORDERS', JSON.stringify(imported));
                alert("✅ Архив успешно восстановлен из резервной копии!");
                openArchiveModal();
            } else {
                alert("Неверный формат файла резервной копии.");
            }
        } catch(err) {
            alert("Ошибка чтения файла. Похоже, это не файл резервной копии JSON.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// =======================================================
// РАБОТА С БАЗОЙ ДАННЫХ EXCEL ЧЕРЕЗ FILE SYSTEM ACCESS API
// =======================================================

let dbFileHandle = null;
const dbName = "OkonMontajDB";
const storeName = "fileHandles";

function openIDB() {
    return new Promise((resolve, reject) => {
        let request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = function(e) {
            let db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = function(e) { resolve(e.target.result); };
        request.onerror = function(e) { reject(e.target.error); };
    });
}

async function saveHandleToIDB(handle) {
    let idb = await openIDB();
    return new Promise((resolve, reject) => {
        let tx = idb.transaction(storeName, "readwrite");
        let store = tx.objectStore(storeName);
        let request = store.put(handle, "dbFileHandle");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getHandleFromIDB() {
    let idb = await openIDB();
    return new Promise((resolve, reject) => {
        let tx = idb.transaction(storeName, "readonly");
        let store = tx.objectStore(storeName);
        let request = store.get("dbFileHandle");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteHandleFromIDB() {
    let idb = await openIDB();
    return new Promise((resolve, reject) => {
        let tx = idb.transaction(storeName, "readwrite");
        let store = tx.objectStore(storeName);
        let request = store.delete("dbFileHandle");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) { options.mode = 'readwrite'; }
    if ((await fileHandle.queryPermission(options)) === 'granted') { return true; }
    if ((await fileHandle.requestPermission(options)) === 'granted') { return true; }
    return false;
}

async function connectExcelDatabase() {
    try {
        const options = {
            types: [{
                description: 'Файлы Excel (*.xlsx)',
                accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
            }],
            excludeAcceptAllOption: true,
            multiple: false
        };
        
        let [handle] = await window.showOpenFilePicker(options);
        dbFileHandle = handle;
        
        await saveHandleToIDB(handle);
        await updateDbStatusUI(true);
        alert(`✅ База данных подключена к файлу: ${handle.name}`);
    } catch (err) {
        if (err.name !== 'AbortError') { console.error("Ошибка подключения к файлу", err); alert("Не удалось подключить файл базы данных."); }
    }
}

async function disconnectExcelDatabase() {
    dbFileHandle = null;
    await deleteHandleFromIDB();
    await updateDbStatusUI(false);
    alert("🔌 База данных отключена.");
}

async function updateDbStatusUI(connected) {
    let badge = document.getElementById('db-status-badge');
    let disconnectBtn = document.getElementById('db-disconnect-btn');
    
    if (connected && dbFileHandle) {
        badge.innerText = "Подключена";
        badge.classList.remove('bg-red-100', 'text-red-700', 'bg-amber-100', 'text-amber-700');
        badge.classList.add('bg-green-100', 'text-green-700');
        disconnectBtn.classList.remove('hidden');
    } else {
        badge.innerText = "Отключена";
        badge.classList.remove('bg-green-100', 'text-green-700', 'bg-amber-100', 'text-amber-700');
        badge.classList.add('bg-red-100', 'text-red-700');
        disconnectBtn.classList.add('hidden');
    }
}

async function tryAutoConnectDb() {
    try {
        let handle = await getHandleFromIDB();
        if (handle) {
            dbFileHandle = handle;
            let permission = await handle.queryPermission({mode: 'readwrite'});
            if (permission === 'granted') {
                await updateDbStatusUI(true);
            } else {
                let badge = document.getElementById('db-status-badge');
                badge.innerText = "Нужен доступ";
                badge.classList.remove('bg-red-100', 'text-red-700');
                badge.classList.add('bg-amber-100', 'text-amber-700');
                document.getElementById('db-disconnect-btn').classList.remove('hidden');
            }
        }
    } catch (err) { console.error("Ошибка автоподключения", err); }
}

async function saveCartToExcelDatabase() {
    if (ITEMS.length === 0) { alert("Смета пуста! Добавьте товары."); return; }
    if (!dbFileHandle) { alert("Файл базы данных не подключен."); return; }

    let hasPermission = await verifyPermission(dbFileHandle, true);
    if (!hasPermission) { alert("Не получен доступ к записи файла. Подтвердите доступ в браузере."); return; }

    try {
        let file = await dbFileHandle.getFile();
        let buffer = await file.arrayBuffer();
        let workbook;
        let ws;
        let existingRows = [];

        if (buffer.byteLength > 0) {
            try {
                workbook = XLSX.read(new Uint8Array(buffer), {type: 'array'});
                if (workbook.SheetNames.includes("Заказы")) {
                    ws = workbook.Sheets["Заказы"];
                    existingRows = XLSX.utils.sheet_to_json(ws, {header: 1});
                }
            } catch(e) { console.log("Создаем новую структуру базы."); }
        }

        if (!workbook) { workbook = XLSX.book_new(); }

        if (existingRows.length === 0) {
            existingRows.push([
                "ID Заказа", "Имя заказа", "Дата", "Позиция №", "Наименование изделия", "Характеристики", 
                "Доп. опции", "Кол-во (шт)", "Розничная цена (шт)", "Дилерская цена (шт)", 
                "Розничная сумма", "Дилерская сумма", "Прибыль", "ИТОГО ПО ЗАКАЗУ", "ПРИБЫЛЬ ПО ЗАКАЗУ", "Наценка"
            ]);
        }

        let orderId = Date.now().toString().slice(-6);
        let dateTime = new Date().toLocaleString("ru-RU");
        let markupPercent = parseInt(document.getElementById('global-markup').value) || 0;
        let markupFactor = 1 + (markupPercent / 100);
        
        let totalRetail = 0;
        let totalDealer = 0;
        ITEMS.forEach(it => {
            let finalRetail = it.type === 'net'
                ? Math.round(it.dealer * markupFactor) + (it.montageCost !== undefined ? it.montageCost : (it.opts && it.opts.includes("Монтаж") ? (it.title.includes("Дверная") || it.title.includes("плиссе") ? 1000 : 500) : 0))
                : Math.round(it.retail * markupFactor);
            totalRetail += finalRetail * it.qty;
            totalDealer += it.dealer * it.qty;
        });
        let totalProfit = totalRetail - totalDealer;

        ITEMS.forEach((it, index) => {
            let finalRetail = it.type === 'net'
                ? Math.round(it.dealer * markupFactor) + (it.montageCost !== undefined ? it.montageCost : (it.opts && it.opts.includes("Монтаж") ? (it.title.includes("Дверная") || it.title.includes("плиссе") ? 1000 : 500) : 0))
                : Math.round(it.retail * markupFactor);
            let itemRetailSum = finalRetail * it.qty;
            let itemDealerSum = it.dealer * it.qty;
            let itemProfit = itemRetailSum - itemDealerSum;

            let row = [
                orderId, CURRENT_ORDER_NAME, dateTime, index + 1, it.title, it.text, it.opts || "-",
                it.qty, finalRetail || "-", it.dealer || "-", itemRetailSum || "-", itemDealerSum || "-", itemProfit || "-",
                index === 0 ? totalRetail : "", index === 0 ? totalProfit : "", index === 0 ? `${markupPercent}%` : ""
            ];
            existingRows.push(row);
        });

        existingRows.push([]); // Пустая строка для читаемости

        let newWs = XLSX.utils.aoa_to_sheet(existingRows);
        newWs['!cols'] = [ {wch: 10}, {wch: 25}, {wch: 20}, {wch: 10}, {wch: 32}, {wch: 50}, {wch: 30}, {wch: 12}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 15}, {wch: 22}, {wch: 22}, {wch: 10} ];

        if (workbook.SheetNames.includes("Заказы")) { workbook.Sheets["Заказы"] = newWs; } 
        else { XLSX.book_append_sheet(workbook, newWs, "Заказы"); }

        let wbout = XLSX.write(workbook, {bookType: 'xlsx', type: 'array'});
        let writable = await dbFileHandle.createWritable();
        await writable.write(wbout);
        await writable.close();

        alert(`🎉 Заказ "${CURRENT_ORDER_NAME}" (#${orderId}) на сумму ${totalRetail.toLocaleString()} ₽ успешно записан в Excel-базу!`);
        clearCart();
        await updateDbStatusUI(true);
    } catch (err) {
        console.error("Ошибка сохранения в базу Excel", err);
        alert("Не удалось сохранить заказ. Убедитесь, что файл Excel закрыт в других программах.");
    }
}

// ==========================================
// ИМПОРТ/ЭКСПОРТ ШАБЛОНОВ (Только Москитные сетки)
// ==========================================
function downloadPriceTemplate() {
    let wb = XLSX.utils.book_new();
    let netsData = Object.entries(PRICES.nets).map(([name, p]) => [name, p.r_less, p.r_more, p.d_less, p.d_more]);
    netsData.unshift(["Название системы", "Розничная (до 0.8м²)", "Розничная (от 0.8м²)", "Дилерская (до 0.8м²)", "Дилерская (от 0.8м²)"]);
    let wsNets = XLSX.utils.aoa_to_sheet(netsData);
    XLSX.book_append_sheet(wb, wsNets, "Москитные сетки");
    
    XLSX.writeFile(wb, "Шаблон_Прайса.xlsx");
}

function uploadPriceExcel(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, {type: 'array'});
            let newPrices = JSON.parse(JSON.stringify(PRICES)); 

            if (workbook.SheetNames.includes("Москитные сетки")) {
                let ws = workbook.Sheets["Москитные сетки"];
                let rows = XLSX.utils.sheet_to_json(ws, {header: 1});
                rows.forEach((row, idx) => {
                    if (idx > 0 && row.length >= 5) {
                        let name = String(row[0] || '').trim();
                        if (newPrices.nets[name]) {
                            newPrices.nets[name].r_less = parseFloat(row[1]) || newPrices.nets[name].r_less;
                            newPrices.nets[name].r_more = parseFloat(row[2]) || newPrices.nets[name].r_more;
                            newPrices.nets[name].d_less = parseFloat(row[3]) || newPrices.nets[name].d_less;
                            newPrices.nets[name].d_more = parseFloat(row[4]) || newPrices.nets[name].d_more;
                        }
                    }
                });
                
                PRICES = newPrices;
                localStorage.setItem('OKON_PRICES', JSON.stringify(PRICES));
                document.getElementById('price-status').innerText = 'Пользовательский';
                document.getElementById('price-status-text').innerText = 'Загружен свой прайс';
                alert(`✅ Прайс-лист на москитные сетки успешно обновлен!`);
                renderCart();
            } else {
                alert("Ошибка: в файле нет листа 'Москитные сетки'. Скачайте шаблон.");
            }
        } catch(err) { console.error(err); alert("Ошибка чтения файла Excel."); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

// ==========================================
// НАВИГАЦИЯ МЕЖДУ ПОЛЯМИ ПО ENTER
// ==========================================
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        let target = event.target;
        if (target.tagName === 'INPUT' && target.type === 'number') {
            let nextId = target.getAttribute('data-next');
            if (nextId) {
                event.preventDefault();
                let nextEl = document.getElementById(nextId);
                if (nextEl) {
                    if (nextEl.tagName === 'BUTTON') {
                        nextEl.focus();
                        nextEl.click();
                    } else {
                        nextEl.focus();
                    }
                }
            }
        }
    }
});