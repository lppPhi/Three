import * as THREE from 'three';

// --- DOM Elements ---
const canvas = document.getElementById('renderCanvas');
const scoreDisplay = document.getElementById('scoreDisplay');
const instructionsDiv = document.getElementById('instructions');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const finalScoreDisplay = document.getElementById('finalScore');
const startButton = document.getElementById('startButton');

// --- Three.js Setup ---
let scene, camera, renderer, clock;
let player, groundSegments = [], obstacles = [];
let activeGroundSegments = new Set(); // Dùng Set để quản lý segment hiệu quả
let activeObstacles = new Set();

// --- Game State & Config ---
const LANE_WIDTH = 3; // Chiều rộng mỗi làn
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH]; // Tọa độ X của các làn
const PLAYER_START_Z = 5;
const CAMERA_OFFSET = new THREE.Vector3(0, 5, 10); // Vị trí camera so với player
const GROUND_LENGTH = 50; // Chiều dài mỗi đoạn đường
const GROUND_WIDTH = LANE_WIDTH * 3 + 2; // Chiều rộng đường (3 làn + lề)
const MAX_ACTIVE_SEGMENTS = 5; // Số đoạn đường hiển thị cùng lúc
const OBSTACLE_PROBABILITY = 0.3; // Xác suất có chướng ngại vật trên đoạn đường mới
let playerSpeed = 0.15; // Tốc độ ban đầu
const PLAYER_ACCELERATION = 0.0001; // Gia tốc
const PLAYER_LANE_SPEED = 0.1; // Tốc độ chuyển làn

let score = 0;
let gameState = 'menu'; // 'menu', 'playing', 'gameOver'
let targetLane = 1; // Làn giữa (index 0, 1, 2)
let currentLane = 1;

// --- Initialize ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x111111, 10, GROUND_LENGTH * (MAX_ACTIVE_SEGMENTS - 2)); // Thêm sương mù

    // Clock
    clock = new THREE.Clock();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Vị trí ban đầu của camera (sẽ được cập nhật theo player)
    camera.position.set(LANES[currentLane] + CAMERA_OFFSET.x, CAMERA_OFFSET.y, PLAYER_START_Z + CAMERA_OFFSET.z);
    camera.lookAt(LANES[currentLane], 0, PLAYER_START_Z); // Nhìn vào player

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // Bật shadow map (nếu muốn thêm bóng đổ)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Ánh sáng môi trường
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Ánh sáng hướng
    directionalLight.position.set(5, 10, 7);
    // directionalLight.castShadow = true; // Bật đổ bóng (cần cấu hình thêm)
    scene.add(directionalLight);

    // Player
    const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Màu đỏ
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(LANES[currentLane], 0.5, PLAYER_START_Z); // Vị trí ban đầu
    // player.castShadow = true;
    scene.add(player);

    // Initial Ground Segments
    for (let i = 0; i < MAX_ACTIVE_SEGMENTS; i++) {
        createGroundSegment(i * -GROUND_LENGTH + PLAYER_START_Z); // Tạo các đoạn đường ban đầu
    }

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    startButton.addEventListener('click', startGame);

    // Start animation loop
    animate();
}

// --- Create Ground Segment ---
function createGroundSegment(zPos) {
    const groundGeometry = new THREE.PlaneGeometry(GROUND_WIDTH, GROUND_LENGTH);
    // Màu xen kẽ cho dễ nhìn
    const segmentColor = activeGroundSegments.size % 2 === 0 ? 0x444455 : 0x555566;
    const groundMaterial = new THREE.MeshStandardMaterial({ color: segmentColor, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Xoay mặt phẳng nằm ngang
    ground.position.set(0, 0, zPos - GROUND_LENGTH / 2); // Đặt vị trí
    // ground.receiveShadow = true; // Nhận bóng đổ
    scene.add(ground);
    groundSegments.push(ground); // Thêm vào mảng quản lý chung
    activeGroundSegments.add(ground); // Thêm vào Set quản lý segment đang active

    // Add Obstacles (trừ đoạn đầu tiên)
    if (zPos < PLAYER_START_Z - GROUND_LENGTH / 2 && Math.random() < OBSTACLE_PROBABILITY) {
        createObstacle(ground);
    }
}

// --- Create Obstacle ---
function createObstacle(parentSegment) {
    const obstacleGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Màu vàng
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);

    const laneIndex = Math.floor(Math.random() * LANES.length); // Chọn làn ngẫu nhiên
    obstacle.position.set(
        LANES[laneIndex],
        0.75, // Nửa chiều cao obstacle
        parentSegment.position.z + (Math.random() - 0.5) * GROUND_LENGTH * 0.8 // Vị trí Z ngẫu nhiên trên segment
    );
    // obstacle.castShadow = true;
    scene.add(obstacle);
    obstacles.push(obstacle); // Thêm vào mảng quản lý chung
    activeObstacles.add(obstacle); // Thêm vào Set quản lý obstacle đang active
}

// --- Game Logic Update ---
function update(deltaTime) {
    if (gameState !== 'playing') return;

    // --- Player Movement ---
    // Forward movement
    playerSpeed += PLAYER_ACCELERATION * deltaTime * 60; // Tăng tốc độ theo thời gian
    player.position.z -= playerSpeed * deltaTime * 60; // Di chuyển về phía trước (trục Z âm)

    // Lane switching (lerp for smooth transition)
    const targetX = LANES[targetLane];
    player.position.x = THREE.MathUtils.lerp(player.position.x, targetX, PLAYER_LANE_SPEED);
    currentLane = targetLane; // Cập nhật làn hiện tại khi di chuyển đủ gần (hoặc ngay lập tức tùy logic)


    // --- Camera Follow ---
    const cameraTargetX = player.position.x + CAMERA_OFFSET.x;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetX, 0.1); // Di chuyển X mượt
    camera.position.y = CAMERA_OFFSET.y; // Giữ độ cao cố định
    camera.position.z = player.position.z + CAMERA_OFFSET.z; // Di chuyển Z theo player

    // Cập nhật điểm nhìn của camera
    const lookAtTarget = new THREE.Vector3(player.position.x, 0, player.position.z - 5); // Nhìn về phía trước player một chút
    camera.lookAt(lookAtTarget);

    // --- Ground Generation/Cleanup ---
    const playerSegmentThreshold = player.position.z - GROUND_LENGTH / 2; // Ngưỡng để tạo segment mới
    const lastSegment = groundSegments[groundSegments.length - 1];

    // Tạo segment mới nếu player đi đủ xa
    if (lastSegment.position.z > playerSegmentThreshold) {
        createGroundSegment(lastSegment.position.z - GROUND_LENGTH);
    }

    // Dọn dẹp segment và obstacle cũ phía sau camera
    const cleanupThreshold = camera.position.z + GROUND_LENGTH; // Ngưỡng dọn dẹp
    for (let i = groundSegments.length - 1; i >= 0; i--) {
        const segment = groundSegments[i];
        if (segment.position.z > cleanupThreshold && activeGroundSegments.has(segment)) {
             // Dọn dẹp các obstacle trên segment này trước
             const obstaclesToRemove = obstacles.filter(obs =>
                 obs.position.z > segment.position.z - GROUND_LENGTH / 2 &&
                 obs.position.z < segment.position.z + GROUND_LENGTH / 2 &&
                 activeObstacles.has(obs)
             );
             obstaclesToRemove.forEach(obs => {
                 scene.remove(obs);
                 activeObstacles.delete(obs);
                 // Có thể dùng object pooling thay vì xóa hoàn toàn
             });

            // Dọn dẹp segment
            scene.remove(segment);
            activeGroundSegments.delete(segment);
            // Không xóa khỏi mảng groundSegments vì index quan trọng, chỉ xóa khỏi Set active
            // Hoặc dùng cấu trúc dữ liệu khác nếu cần tối ưu hơn
        }
    }

    // --- Collision Detection ---
    const playerBox = new THREE.Box3().setFromObject(player);
    activeObstacles.forEach(obstacle => {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        if (playerBox.intersectsBox(obstacleBox)) {
            gameOver();
        }
    });

    // --- Scoring ---
    score = Math.max(0, Math.floor(-player.position.z)); // Điểm dựa trên quãng đường Z âm
    scoreDisplay.textContent = `Score: ${score}`;
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate); // Lặp lại animation

    const deltaTime = clock.getDelta(); // Thời gian từ frame trước

    if (gameState === 'playing') {
        update(deltaTime); // Cập nhật logic game
    }

    renderer.render(scene, camera); // Vẽ scene
}

// --- Event Handlers ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (gameState !== 'playing') return;

    switch (event.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
            targetLane = Math.max(0, currentLane - 1); // Chuyển sang trái (index giảm)
            break;
        case 'd':
        case 'arrowright':
            targetLane = Math.min(LANES.length - 1, currentLane + 1); // Chuyển sang phải (index tăng)
            break;
    }
}

// --- Game State Functions ---
function startGame() {
    console.log("Starting Game");
    // Reset game state
    score = 0;
    playerSpeed = 0.15; // Reset tốc độ
    targetLane = 1;
    currentLane = 1;
    player.position.set(LANES[currentLane], 0.5, PLAYER_START_Z);
    camera.position.set(LANES[currentLane] + CAMERA_OFFSET.x, CAMERA_OFFSET.y, PLAYER_START_Z + CAMERA_OFFSET.z);
    camera.lookAt(LANES[currentLane], 0, PLAYER_START_Z);

    // Clear existing obstacles and segments
    activeObstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    activeObstacles.clear();
    activeGroundSegments.forEach(seg => scene.remove(seg));
    groundSegments = [];
    activeGroundSegments.clear();

    // Create initial segments again
    for (let i = 0; i < MAX_ACTIVE_SEGMENTS; i++) {
        createGroundSegment(i * -GROUND_LENGTH + PLAYER_START_Z);
    }


    // Update UI
    overlay.classList.remove('active');
    instructionsDiv.classList.remove('hidden');
    scoreDisplay.classList.remove('hidden');
    scoreDisplay.textContent = `Score: ${score}`; // Reset hiển thị điểm

    gameState = 'playing';
    canvas.focus(); // Cho phép nhận keydown
}

function gameOver() {
    console.log("Game Over");
    gameState = 'gameOver';

    // Update UI
    overlayTitle.textContent = 'Game Over!';
    overlayText.classList.add('hidden'); // Ẩn text "Press Start"
    finalScoreDisplay.textContent = `Final Score: ${score}`;
    finalScoreDisplay.classList.remove('hidden'); // Hiện điểm cuối
    startButton.textContent = 'Restart'; // Đổi nút thành Restart
    overlay.classList.add('active');
    instructionsDiv.classList.add('hidden');
    // scoreDisplay.classList.add('hidden'); // Có thể ẩn điểm ở góc
}

// --- Start ---
init();