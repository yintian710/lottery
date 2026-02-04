// 数据存储
const STORAGE_KEY = 'lottery_activities';

// 当前状态
let currentActivity = null;
let currentActivityId = null;
let isDrawing = false;
let drawInterval = null;
let currentDrawCount = 0;
let currentWinners = [];

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    renderActivityList();
});

// ==================== 数据管理 ====================

function getActivities() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveActivities(activities) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('存储空间不足！请尝试删除一些活动或减少图片数量/尺寸。');
        } else {
            alert('保存失败：' + e.message);
        }
        return false;
    }
}

function getActivityById(id) {
    const activities = getActivities();
    return activities.find(a => a.id === id);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== 页面切换 ====================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function goToHome() {
    showPage('home-page');
    renderActivityList();
}

// ==================== 活动列表页 ====================

function renderActivityList() {
    const activities = getActivities();
    const container = document.getElementById('activity-list');

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>暂无活动</h3>
                <p>点击"创建新活动"开始使用</p>
            </div>
        `;
        return;
    }

    container.innerHTML = activities.map(activity => `
        <div class="activity-card">
            <h3>${escapeHtml(activity.name)}</h3>
            <div class="activity-card-info">
                <span>奖品数: ${activity.prizes.length}</span>
                <span>参与人数: ${activity.participants.length}</span>
                <span>已抽奖: ${activity.winners ? Object.keys(activity.winners).length : 0} 个奖品</span>
            </div>
            <div class="activity-card-actions">
                <button class="btn btn-primary btn-small" onclick="startLotteryFromList('${activity.id}')">开始抽奖</button>
                <button class="btn btn-secondary btn-small" onclick="editActivity('${activity.id}')">编辑</button>
                <button class="btn btn-secondary btn-small" onclick="viewWinners('${activity.id}')">中奖名单</button>
                <button class="btn btn-danger btn-small" onclick="deleteActivity('${activity.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// ==================== 活动编辑 ====================

function createNewActivity() {
    currentActivityId = null;
    currentActivity = {
        id: generateId(),
        name: '',
        prizes: [],
        participants: [],
        blacklistWinners: true,
        winners: {},
        blacklist: []
    };

    document.getElementById('edit-title').textContent = '创建活动';
    document.getElementById('activity-name').value = '';
    document.getElementById('blacklist-winners').checked = true;
    document.getElementById('prizes-container').innerHTML = '';
    updateParticipantCount();

    showPage('edit-page');
}

function editActivity(id) {
    const activity = getActivityById(id);
    if (!activity) return;

    currentActivityId = id;
    currentActivity = JSON.parse(JSON.stringify(activity));

    document.getElementById('edit-title').textContent = '编辑活动';
    document.getElementById('activity-name').value = activity.name;
    document.getElementById('blacklist-winners').checked = activity.blacklistWinners;

    renderPrizes();
    updateParticipantCount();

    showPage('edit-page');
}

function deleteActivity(id) {
    if (!confirm('确定要删除这个活动吗？')) return;

    const activities = getActivities().filter(a => a.id !== id);
    saveActivities(activities);
    renderActivityList();
}

// ==================== 奖品管理 ====================

function renderPrizes() {
    const container = document.getElementById('prizes-container');
    container.innerHTML = currentActivity.prizes.map((prize, index) => `
        <div class="prize-item" data-index="${index}">
            <div class="prize-header">
                <h4>奖品 ${index + 1}</h4>
                <button class="btn btn-danger btn-small" onclick="removePrize(${index})">删除</button>
            </div>
            <div class="prize-fields">
                <div class="form-group">
                    <label>奖品名称</label>
                    <input type="text" value="${escapeHtml(prize.name)}"
                           onchange="updatePrize(${index}, 'name', this.value)" placeholder="输入奖品名称">
                </div>
                <div class="form-group">
                    <label>中奖人数</label>
                    <input type="number" value="${prize.count}" min="1"
                           onchange="updatePrize(${index}, 'count', parseInt(this.value))" placeholder="1">
                </div>
                <div class="form-group">
                    <label>奖品图片</label>
                    <input type="file" accept="image/*" onchange="updatePrizeImage(${index}, event)">
                    ${prize.image ? `
                        <div style="margin-top: 8px;">
                            <img src="${prize.image}" class="prize-image-preview">
                            <button class="btn btn-small" onclick="removePrizeImage(${index})" style="margin-left: 10px;">移除图片</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function addPrize() {
    currentActivity.prizes.push({
        id: generateId(),
        name: '',
        count: 1,
        image: ''
    });
    renderPrizes();
}

function removePrize(index) {
    currentActivity.prizes.splice(index, 1);
    renderPrizes();
}

function updatePrize(index, field, value) {
    currentActivity.prizes[index][field] = value;
}

function removePrizeImage(index) {
    currentActivity.prizes[index].image = '';
    renderPrizes();
}

function updatePrizeImage(index, event) {
    const file = event.target.files[0];
    if (!file) return;

    // 压缩图片后再存储
    compressImage(file, 300, 0.7).then(compressedDataUrl => {
        currentActivity.prizes[index].image = compressedDataUrl;
        renderPrizes();
    }).catch(err => {
        alert('图片处理失败：' + err.message);
    });
}

// 图片压缩函数
function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 计算缩放比例
                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 转换为压缩后的 base64
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

// ==================== 参与人员管理 ====================

function updateParticipantCount() {
    document.getElementById('participant-count').textContent = currentActivity.participants.length;
}

function importParticipants(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split(/\r?\n/).filter(line => line.trim());

        // 合并现有人员，避免重复
        const existingSet = new Set(currentActivity.participants);
        lines.forEach(line => {
            const name = line.trim();
            if (name && !existingSet.has(name)) {
                currentActivity.participants.push(name);
                existingSet.add(name);
            }
        });

        updateParticipantCount();
        alert(`已导入 ${lines.length} 人`);
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Excel 导入相关
let excelData = null; // 存储解析后的 Excel 数据

function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // 解析所有 sheet
            excelData = {
                sheetNames: workbook.SheetNames,
                sheets: {}
            };

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // 查找第一行中"姓名"所在的列
                if (jsonData.length > 0) {
                    const headerRow = jsonData[0];
                    let nameColIndex = -1;

                    for (let i = 0; i < headerRow.length; i++) {
                        const cell = String(headerRow[i] || '').trim();
                        if (cell === '姓名') {
                            nameColIndex = i;
                            break;
                        }
                    }

                    if (nameColIndex >= 0) {
                        // 提取该列的所有名字（跳过表头）
                        const names = [];
                        for (let i = 1; i < jsonData.length; i++) {
                            const name = String(jsonData[i][nameColIndex] || '').trim();
                            if (name) {
                                names.push(name);
                            }
                        }
                        excelData.sheets[sheetName] = {
                            hasNameColumn: true,
                            names: names
                        };
                    } else {
                        excelData.sheets[sheetName] = {
                            hasNameColumn: false,
                            names: []
                        };
                    }
                } else {
                    excelData.sheets[sheetName] = {
                        hasNameColumn: false,
                        names: []
                    };
                }
            });

            // 显示导入确认弹窗
            showExcelImportModal();
        } catch (err) {
            alert('Excel 解析失败：' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function showExcelImportModal() {
    if (!excelData || excelData.sheetNames.length === 0) {
        alert('Excel 文件为空或无法解析');
        return;
    }

    // 填充 sheet 选择器
    const select = document.getElementById('excel-sheet-select');
    select.innerHTML = excelData.sheetNames.map((name, index) => {
        const sheetInfo = excelData.sheets[name];
        const status = sheetInfo.hasNameColumn ? `(${sheetInfo.names.length} 人)` : '(无姓名列)';
        return `<option value="${index}">${escapeHtml(name)} ${status}</option>`;
    }).join('');

    // 显示第一个 sheet 的预览
    selectExcelSheet();

    document.getElementById('excel-import-modal').classList.add('active');
}

function closeExcelImportModal() {
    document.getElementById('excel-import-modal').classList.remove('active');
    excelData = null;
}

function selectExcelSheet() {
    const select = document.getElementById('excel-sheet-select');
    const sheetIndex = parseInt(select.value);
    const sheetName = excelData.sheetNames[sheetIndex];
    const sheetInfo = excelData.sheets[sheetName];

    const infoContainer = document.getElementById('excel-import-info');
    const previewContainer = document.getElementById('excel-preview-list');
    const confirmBtn = document.getElementById('confirm-excel-import-btn');

    if (!sheetInfo.hasNameColumn) {
        infoContainer.innerHTML = '<div class="warning">该工作表第一行没有找到"姓名"列</div>';
        previewContainer.innerHTML = '<div class="empty-state"><p>无可导入的数据</p></div>';
        confirmBtn.disabled = true;
        return;
    }

    // 检查重复
    const names = sheetInfo.names;
    const existingSet = new Set(currentActivity.participants);
    const nameCount = {};
    const duplicatesInFile = [];
    const duplicatesWithExisting = [];

    names.forEach(name => {
        nameCount[name] = (nameCount[name] || 0) + 1;
        if (nameCount[name] === 2) {
            duplicatesInFile.push(name);
        }
        if (existingSet.has(name) && !duplicatesWithExisting.includes(name)) {
            duplicatesWithExisting.push(name);
        }
    });

    // 去重后的名单
    const uniqueNames = [...new Set(names)];
    const newNames = uniqueNames.filter(name => !existingSet.has(name));

    // 显示信息
    let infoHtml = '<div class="info-row">';
    infoHtml += `<span>总计: ${names.length} 人</span>`;
    infoHtml += `<span>去重后: ${uniqueNames.length} 人</span>`;
    infoHtml += `<span class="success">新增: ${newNames.length} 人</span>`;
    infoHtml += '</div>';

    if (duplicatesInFile.length > 0) {
        infoHtml += `<div class="info-row warning">文件内重复: ${duplicatesInFile.join('、')}</div>`;
    }
    if (duplicatesWithExisting.length > 0) {
        infoHtml += `<div class="info-row warning">与现有名单重复: ${duplicatesWithExisting.join('、')}</div>`;
    }

    infoContainer.innerHTML = infoHtml;

    // 显示预览列表
    previewContainer.innerHTML = uniqueNames.map(name => {
        const isDupInFile = duplicatesInFile.includes(name);
        const isDupWithExisting = duplicatesWithExisting.includes(name);
        const isDup = isDupInFile || isDupWithExisting;

        let badge = '';
        if (isDupWithExisting) {
            badge = '<span class="dup-badge">已存在</span>';
        } else if (isDupInFile) {
            badge = '<span class="dup-badge">文件内重复</span>';
        }

        return `<div class="preview-item ${isDup ? 'duplicate' : ''}">${escapeHtml(name)}${badge}</div>`;
    }).join('');

    confirmBtn.disabled = newNames.length === 0;

    // 存储待导入的数据
    excelData.pendingImport = newNames;
}

function confirmExcelImport() {
    if (!excelData || !excelData.pendingImport || excelData.pendingImport.length === 0) {
        alert('没有可导入的数据');
        return;
    }

    const newNames = excelData.pendingImport;
    currentActivity.participants.push(...newNames);

    updateParticipantCount();
    closeExcelImportModal();
    alert(`成功导入 ${newNames.length} 人`);
}

function exportParticipants() {
    if (currentActivity.participants.length === 0) {
        alert('没有参与人员可导出');
        return;
    }

    const content = currentActivity.participants.join('\n');
    downloadFile(content, `${currentActivity.name || '活动'}_参与名单.csv`, 'text/csv');
}

function showParticipantManager() {
    renderParticipantList();
    document.getElementById('participant-modal').classList.add('active');
}

function closeParticipantModal() {
    document.getElementById('participant-modal').classList.remove('active');
}

function renderParticipantList() {
    const container = document.getElementById('participant-list');
    const blacklist = currentActivity.blacklist || [];

    // 重置全选和选中计数
    const selectAllCheckbox = document.getElementById('select-all-participants');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateSelectedCount();

    if (currentActivity.participants.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无参与人员</p></div>';
        return;
    }

    container.innerHTML = currentActivity.participants.map((name, index) => {
        const isBlacklisted = blacklist.includes(name);
        return `
            <div class="participant-item ${isBlacklisted ? 'blacklisted' : ''}">
                <div class="participant-left">
                    <input type="checkbox" class="participant-checkbox" data-index="${index}" onchange="updateSelectedCount()">
                    <span>${escapeHtml(name)} ${isBlacklisted ? '(已中奖)' : ''}</span>
                </div>
                <button class="btn btn-danger btn-small" onclick="removeParticipant(${index})">删除</button>
            </div>
        `;
    }).join('');
}

// 全选/取消全选
function toggleSelectAll() {
    const selectAll = document.getElementById('select-all-participants').checked;
    document.querySelectorAll('.participant-checkbox').forEach(cb => {
        cb.checked = selectAll;
    });
    updateSelectedCount();
}

// 更新选中计数
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.participant-checkbox:checked');
    const count = checkboxes.length;
    const countEl = document.getElementById('selected-count');
    const deleteBtn = document.getElementById('delete-selected-btn');

    if (countEl) countEl.textContent = `已选择 ${count} 人`;
    if (deleteBtn) deleteBtn.disabled = count === 0;
}

// 删除选中的人员
function deleteSelectedParticipants() {
    const checkboxes = document.querySelectorAll('.participant-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`确定要删除选中的 ${checkboxes.length} 人吗？`)) return;

    // 收集要删除的索引（从大到小排序，避免删除时索引变化）
    const indices = Array.from(checkboxes)
        .map(cb => parseInt(cb.dataset.index))
        .sort((a, b) => b - a);

    indices.forEach(index => {
        currentActivity.participants.splice(index, 1);
    });

    updateParticipantCount();
    renderParticipantList();
}

function addParticipant() {
    const input = document.getElementById('new-participant');
    const name = input.value.trim();

    if (!name) {
        alert('请输入姓名');
        return;
    }

    if (currentActivity.participants.includes(name)) {
        alert('该人员已存在');
        return;
    }

    currentActivity.participants.push(name);
    input.value = '';
    updateParticipantCount();
    renderParticipantList();
}

function removeParticipant(index) {
    currentActivity.participants.splice(index, 1);
    updateParticipantCount();
    renderParticipantList();
}

// ==================== 活动保存与导入导出 ====================

function saveActivity() {
    currentActivity.name = document.getElementById('activity-name').value.trim();
    currentActivity.blacklistWinners = document.getElementById('blacklist-winners').checked;

    if (!currentActivity.name) {
        alert('请输入活动名称');
        return;
    }

    if (currentActivity.prizes.length === 0) {
        alert('请至少添加一个奖品');
        return;
    }

    for (let prize of currentActivity.prizes) {
        if (!prize.name) {
            alert('请填写所有奖品的名称');
            return;
        }
    }

    const activities = getActivities();
    const existingIndex = activities.findIndex(a => a.id === currentActivity.id);

    if (existingIndex >= 0) {
        activities[existingIndex] = currentActivity;
    } else {
        activities.push(currentActivity);
    }

    if (saveActivities(activities)) {
        alert('保存成功！');
    }
}

function exportActivityConfig() {
    currentActivity.name = document.getElementById('activity-name').value.trim();
    currentActivity.blacklistWinners = document.getElementById('blacklist-winners').checked;

    const config = JSON.stringify(currentActivity, null, 2);
    downloadFile(config, `${currentActivity.name || '活动'}_配置.json`, 'application/json');
}

function importActivityConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target.result);

            // 验证配置
            if (!config.prizes || !Array.isArray(config.prizes)) {
                throw new Error('无效的配置文件');
            }

            // 创建新活动
            currentActivityId = null;
            currentActivity = {
                ...config,
                id: generateId(),
                winners: {},
                blacklist: []
            };

            document.getElementById('edit-title').textContent = '导入活动';
            document.getElementById('activity-name').value = currentActivity.name || '';
            document.getElementById('blacklist-winners').checked = currentActivity.blacklistWinners !== false;

            renderPrizes();
            updateParticipantCount();

            showPage('edit-page');
            alert('导入成功！');
        } catch (err) {
            alert('导入失败：' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ==================== 抽奖功能 ====================

function startLottery() {
    // 先保存当前状态
    currentActivity.name = document.getElementById('activity-name').value.trim();
    currentActivity.blacklistWinners = document.getElementById('blacklist-winners').checked;

    if (!currentActivity.name) {
        alert('请输入活动名称');
        return;
    }

    if (currentActivity.prizes.length === 0) {
        alert('请至少添加一个奖品');
        return;
    }

    if (currentActivity.participants.length === 0) {
        alert('请添加参与人员');
        return;
    }

    // 保存活动
    const activities = getActivities();
    const existingIndex = activities.findIndex(a => a.id === currentActivity.id);
    if (existingIndex >= 0) {
        activities[existingIndex] = currentActivity;
    } else {
        activities.push(currentActivity);
    }

    if (!saveActivities(activities)) {
        return; // 保存失败时不继续
    }

    enterLotteryPage();
}

function startLotteryFromList(id) {
    const activity = getActivityById(id);
    if (!activity) return;

    currentActivityId = id;
    currentActivity = JSON.parse(JSON.stringify(activity));

    if (currentActivity.participants.length === 0) {
        alert('该活动没有参与人员');
        return;
    }

    enterLotteryPage();
}

function enterLotteryPage() {
    document.getElementById('lottery-title').textContent = currentActivity.name;

    // 渲染奖品选择器
    const select = document.getElementById('prize-select');
    select.innerHTML = '<option value="">-- 请选择奖品 --</option>' +
        currentActivity.prizes.map((prize, index) => {
            const won = (currentActivity.winners[prize.id] || []).length;
            const remaining = prize.count - won;
            return `<option value="${index}" ${remaining <= 0 ? 'disabled' : ''}>
                ${escapeHtml(prize.name)} (剩余: ${remaining}/${prize.count})
            </option>`;
        }).join('');

    // 重置显示
    document.getElementById('prize-image-container').innerHTML = '';
    document.getElementById('prize-name-display').textContent = '请选择奖品';
    document.getElementById('prize-remaining').textContent = '';
    clearNameSlots();
    document.getElementById('winners-display').style.display = 'none';
    document.getElementById('draw-all-btn').disabled = true;
    document.getElementById('draw-one-btn').disabled = true;

    // 渲染已中奖名单汇总
    renderLotteryWinnersSummary();

    showPage('lottery-page');
}

// 渲染抽奖页面的已中奖名单汇总
function renderLotteryWinnersSummary() {
    const container = document.getElementById('lottery-winners-list');
    const winners = currentActivity.winners || {};

    // 检查是否有中奖记录
    const hasWinners = currentActivity.prizes.some(prize =>
        (winners[prize.id] || []).length > 0
    );

    if (!hasWinners) {
        container.innerHTML = '<div class="empty-hint">暂无中奖记录</div>';
        return;
    }

    container.innerHTML = currentActivity.prizes.map(prize => {
        const prizeWinners = winners[prize.id] || [];
        if (prizeWinners.length === 0) return '';

        return `
            <div class="prize-winner-group">
                <div class="prize-winner-title">
                    ${prize.image ? `<img src="${prize.image}" alt="">` : ''}
                    <span>${escapeHtml(prize.name)} (${prizeWinners.length}/${prize.count})</span>
                </div>
                <div class="winner-names">
                    ${prizeWinners.map(w => `<span class="winner-name">${escapeHtml(w)}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function selectPrize() {
    const select = document.getElementById('prize-select');
    const index = parseInt(select.value);

    const customInput = document.getElementById('draw-custom-count');
    const customBtn = document.getElementById('draw-custom-btn');

    if (isNaN(index)) {
        document.getElementById('prize-image-container').innerHTML = '';
        document.getElementById('prize-name-display').textContent = '请选择奖品';
        document.getElementById('prize-remaining').textContent = '';
        document.getElementById('draw-all-btn').disabled = true;
        document.getElementById('draw-one-btn').disabled = true;
        customInput.disabled = true;
        customBtn.disabled = true;
        return;
    }

    const prize = currentActivity.prizes[index];
    const won = (currentActivity.winners[prize.id] || []).length;
    const remaining = prize.count - won;

    // 显示奖品信息
    document.getElementById('prize-name-display').textContent = prize.name;
    document.getElementById('prize-remaining').textContent = `剩余: ${remaining}/${prize.count}`;

    if (prize.image) {
        document.getElementById('prize-image-container').innerHTML =
            `<img src="${prize.image}" alt="${escapeHtml(prize.name)}">`;
    } else {
        document.getElementById('prize-image-container').innerHTML =
            '<span style="color: rgba(255,255,255,0.3)">无图片</span>';
    }

    // 重置中奖显示
    clearNameSlots();
    document.getElementById('winners-display').style.display = 'none';

    // 检查是否可以抽奖
    const availableParticipants = getAvailableParticipants();
    const maxDraw = Math.min(remaining, availableParticipants.length);
    const canDraw = maxDraw > 0;

    document.getElementById('draw-all-btn').disabled = !canDraw;
    document.getElementById('draw-one-btn').disabled = !canDraw;

    // 设置自定义抽奖输入框
    customInput.disabled = !canDraw;
    customBtn.disabled = !canDraw;
    customInput.max = maxDraw;
    customInput.value = Math.min(parseInt(customInput.value) || 1, maxDraw);
}

function clearNameSlots() {
    const namesContainer = document.getElementById('lottery-names');
    Array.from(namesContainer.children).forEach((nameEl) => {
        nameEl.textContent = '';
        nameEl.style.display = 'none';
        nameEl.classList.remove('winner');
    });
}

function getAvailableParticipants() {
    const blacklist = currentActivity.blacklist || [];
    if (currentActivity.blacklistWinners) {
        return currentActivity.participants.filter(p => !blacklist.includes(p));
    }
    return [...currentActivity.participants];
}

function drawOne() {
    startDrawing(1);
}

function drawAll() {
    const select = document.getElementById('prize-select');
    const index = parseInt(select.value);
    const prize = currentActivity.prizes[index];
    const won = (currentActivity.winners[prize.id] || []).length;
    const remaining = prize.count - won;

    startDrawing(remaining);
}

function drawCustom() {
    const customInput = document.getElementById('draw-custom-count');
    const count = parseInt(customInput.value) || 1;
    const max = parseInt(customInput.max) || 1;

    if (count < 1) {
        alert('请输入有效的数量');
        return;
    }

    if (count > max) {
        alert(`最多只能抽 ${max} 个`);
        customInput.value = max;
        return;
    }

    startDrawing(count);
}

function startDrawing(count) {
    const availableParticipants = getAvailableParticipants();

    if (availableParticipants.length === 0) {
        alert('没有可抽奖的人员');
        return;
    }

    currentDrawCount = Math.min(count, availableParticipants.length);
    currentWinners = [];
    isDrawing = true;

    // 隐藏抽奖按钮，显示停止按钮
    document.getElementById('draw-all-btn').style.display = 'none';
    document.getElementById('draw-one-btn').style.display = 'none';
    document.querySelector('.draw-custom').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'inline-flex';
    document.getElementById('winners-display').style.display = 'none';

    // 计算最长名字的宽度
    const longestName = availableParticipants.reduce((a, b) => a.length > b.length ? a : b, '');
    const nameWidth = Math.max(longestName.length * 28 + 40, 120); // 每个字约28px + padding

    // 创建名字显示元素
    const namesContainer = document.getElementById('lottery-names');
    namesContainer.style.setProperty('--name-width', `${nameWidth}px`);
    const existingCount = namesContainer.children.length;
    for (let i = existingCount; i < currentDrawCount; i++) {
        const nameEl = document.createElement('div');
        nameEl.className = 'lottery-name';
        nameEl.id = `lottery-name-${i}`;
        namesContainer.appendChild(nameEl);
    }
    Array.from(namesContainer.children).forEach((nameEl, index) => {
        nameEl.classList.remove('winner');
        if (index < currentDrawCount) {
            nameEl.style.display = '';
            nameEl.textContent = '';
        } else {
            nameEl.style.display = 'none';
            nameEl.textContent = '';
        }
    });
    const activeNameEls = Array.from(namesContainer.children).slice(0, currentDrawCount);

    // 开始闪烁动画
    drawInterval = setInterval(() => {
        const available = getAvailableParticipants();
        for (let i = 0; i < currentDrawCount; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            activeNameEls[i].textContent = available[randomIndex];
        }
    }, 50);
}

function stopDraw() {
    if (!isDrawing) return;

    isDrawing = false;
    clearInterval(drawInterval);

    // 确定中奖者
    const availableParticipants = getAvailableParticipants();
    const shuffled = [...availableParticipants].sort(() => Math.random() - 0.5);
    currentWinners = shuffled.slice(0, currentDrawCount);

    // 显示中奖者
    for (let i = 0; i < currentDrawCount; i++) {
        const nameEl = document.getElementById(`lottery-name-${i}`);
        nameEl.textContent = currentWinners[i];
        nameEl.classList.add('winner');
    }

    // 保存中奖结果
    saveWinners();

    // 显示中奖名单
    setTimeout(() => {
        document.getElementById('current-winners').innerHTML =
            currentWinners.map(w => `<span>${escapeHtml(w)}</span>`).join('');
        document.getElementById('winners-display').style.display = 'block';

        // 恢复按钮
        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('draw-all-btn').style.display = 'inline-flex';
        document.getElementById('draw-one-btn').style.display = 'inline-flex';
        document.querySelector('.draw-custom').style.display = 'flex';

        // 刷新奖品选择器
        selectPrize();

        // 更新已中奖名单汇总
        renderLotteryWinnersSummary();
    }, 3000); // 中奖名单展示3秒
}

function saveWinners() {
    const select = document.getElementById('prize-select');
    const index = parseInt(select.value);
    const prize = currentActivity.prizes[index];

    // 添加到中奖名单
    if (!currentActivity.winners[prize.id]) {
        currentActivity.winners[prize.id] = [];
    }
    currentActivity.winners[prize.id].push(...currentWinners);

    // 如果开启了拉黑，添加到黑名单
    if (currentActivity.blacklistWinners) {
        if (!currentActivity.blacklist) {
            currentActivity.blacklist = [];
        }
        currentActivity.blacklist.push(...currentWinners);
    }

    // 保存到本地存储
    const activities = getActivities();
    const existingIndex = activities.findIndex(a => a.id === currentActivity.id);
    if (existingIndex >= 0) {
        activities[existingIndex] = currentActivity;
        saveActivities(activities);
    }
}

function exitLottery() {
    if (isDrawing) {
        if (!confirm('抽奖正在进行中，确定要退出吗？')) return;
        clearInterval(drawInterval);
        isDrawing = false;
    }
    goToHome();
}

// ==================== 中奖名单 ====================

function viewWinners(id) {
    const activity = getActivityById(id);
    if (!activity) return;

    currentActivityId = id;
    currentActivity = JSON.parse(JSON.stringify(activity));

    renderAllWinners();
    showPage('winners-page');
}

function renderAllWinners() {
    const container = document.getElementById('all-winners-list');
    const winners = currentActivity.winners || {};

    if (Object.keys(winners).length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>暂无中奖记录</h3></div>';
        return;
    }

    container.innerHTML = currentActivity.prizes.map(prize => {
        const prizeWinners = winners[prize.id] || [];
        if (prizeWinners.length === 0) return '';

        return `
            <div class="prize-winners">
                <h3>
                    ${prize.image ? `<img src="${prize.image}" alt="">` : ''}
                    ${escapeHtml(prize.name)}
                </h3>
                <div class="winner-list">
                    ${prizeWinners.map(w => `<span class="winner-tag">${escapeHtml(w)}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function exportWinners() {
    const winners = currentActivity.winners || {};
    if (Object.keys(winners).length === 0) {
        alert('没有中奖记录可导出');
        return;
    }

    let csv = '奖品,中奖者\n';
    currentActivity.prizes.forEach(prize => {
        const prizeWinners = winners[prize.id] || [];
        prizeWinners.forEach(winner => {
            csv += `"${prize.name}","${winner}"\n`;
        });
    });

    downloadFile(csv, `${currentActivity.name}_中奖名单.csv`, 'text/csv');
}

function clearWinners() {
    if (!confirm('确定要清空所有中奖记录吗？这将开始新一轮抽奖。')) return;

    currentActivity.winners = {};
    currentActivity.blacklist = [];

    // 保存
    const activities = getActivities();
    const existingIndex = activities.findIndex(a => a.id === currentActivity.id);
    if (existingIndex >= 0) {
        activities[existingIndex] = currentActivity;
        saveActivities(activities);
    }

    renderAllWinners();
    alert('已清空中奖记录');
}

// ==================== 工具函数 ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 键盘事件支持
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isDrawing) {
        e.preventDefault();
        stopDraw();
    }
});
