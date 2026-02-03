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

    if (currentActivity.participants.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无参与人员</p></div>';
        return;
    }

    container.innerHTML = currentActivity.participants.map((name, index) => {
        const isBlacklisted = blacklist.includes(name);
        return `
            <div class="participant-item ${isBlacklisted ? 'blacklisted' : ''}">
                <span>${escapeHtml(name)} ${isBlacklisted ? '(已中奖)' : ''}</span>
                <button class="btn btn-danger btn-small" onclick="removeParticipant(${index})">删除</button>
            </div>
        `;
    }).join('');
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
    document.getElementById('lottery-names').innerHTML = '';
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

    if (isNaN(index)) {
        document.getElementById('prize-image-container').innerHTML = '';
        document.getElementById('prize-name-display').textContent = '请选择奖品';
        document.getElementById('prize-remaining').textContent = '';
        document.getElementById('draw-all-btn').disabled = true;
        document.getElementById('draw-one-btn').disabled = true;
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
    document.getElementById('lottery-names').innerHTML = '';
    document.getElementById('winners-display').style.display = 'none';

    // 检查是否可以抽奖
    const availableParticipants = getAvailableParticipants();
    const canDraw = remaining > 0 && availableParticipants.length > 0;

    document.getElementById('draw-all-btn').disabled = !canDraw;
    document.getElementById('draw-one-btn').disabled = !canDraw;
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
    document.getElementById('stop-btn').style.display = 'inline-flex';
    document.getElementById('winners-display').style.display = 'none';

    // 创建名字显示元素
    const namesContainer = document.getElementById('lottery-names');
    namesContainer.innerHTML = '';
    for (let i = 0; i < currentDrawCount; i++) {
        const nameEl = document.createElement('div');
        nameEl.className = 'lottery-name';
        nameEl.id = `lottery-name-${i}`;
        namesContainer.appendChild(nameEl);
    }

    // 开始闪烁动画
    drawInterval = setInterval(() => {
        const available = getAvailableParticipants();
        for (let i = 0; i < currentDrawCount; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            document.getElementById(`lottery-name-${i}`).textContent = available[randomIndex];
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

        // 刷新奖品选择器
        selectPrize();

        // 更新已中奖名单汇总
        renderLotteryWinnersSummary();
    }, 500);
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
