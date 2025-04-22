import * as THREE from 'three';

// --- Khởi tạo cơ bản ---
// ... (Giữ nguyên các phần khởi tạo Scene, Camera, Renderer) ...
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xadd8e6);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Ánh sáng ---
// ... (Giữ nguyên phần ánh sáng) ...
const ambientLight = new THREE.AmbientLight(0x606060);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 15, 7.5);
directionalLight.castShadow = true;
// ... (shadow map settings giữ nguyên) ...
scene.add(directionalLight);


// --- Người chơi ---
// ... (Giữ nguyên phần người chơi: geometry, material, mesh, trạng thái, biến) ...
const playerHeight = 1.8;
const playerCrouchHeight = 1.0;
const playerWidth = 0.5;
const playerDepth = 0.5;
const playerGeometry = new THREE.BoxGeometry(playerWidth, playerHeight, playerDepth);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, playerHeight / 2 + 10, 3); // Bắt đầu cao để rơi xuống
player.castShadow = true;
scene.add(player);

const playerVelocity = new THREE.Vector3();
let onGround = false;
let isCrouching = false;
const playerSpeed = 5.0;
const crouchSpeedMultiplier = 0.5;
const jumpStrength = 10.0; // Có thể cần điều chỉnh nếu làm nhảy xa hơn
const gravity = -19.62;


// ===========================================================
// === BẮT ĐẦU PHẦN MAP / PLATFORMS ĐÃ CẬP NHẬT ===
// ===========================================================
const platforms = [];
const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, metalness: 0.2 }); // Thay đổi vật liệu chút
const winPlatformMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Màu xanh lá cho platform thắng
const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0xcc6600 }); // Vật liệu cho vật cản

function createPlatform(width, height, depth, x, y, z, material = platformMaterial) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const platform = new THREE.Mesh(geometry, material);
    platform.position.set(x, y, z);
    platform.receiveShadow = true;
    platform.castShadow = true;
    scene.add(platform);
    platforms.push(platform); // *** Quan trọng: Thêm vào mảng để kiểm tra va chạm ***
    return platform;
}

// --- Tạo đường đi mới phức tạp hơn ---

// 1. Platform bắt đầu
createPlatform(5, 1, 5, 0, -0.5, 2); // Platform bắt đầu (giữ nguyên)

// 2. Nhảy ngắn lên cao hơn
createPlatform(2, 1, 2, 0, 1.0, -2);

// 3. Nhảy xa sang trái và lên cao
createPlatform(3, 1, 1.5, -5, 2.5, -5);

// 4. Nhảy tới platform hẹp phía trước
createPlatform(1, 1, 4, -5, 2.5, -10); // Platform hẹp và dài

// 5. Nhảy qua phải lên platform cao hơn
createPlatform(2.5, 1, 2.5, 0, 4.0, -12);

// 6. *** Chướng ngại vật yêu cầu NGỒI ***
const crouchBaseY = 4.5;
const crouchBase = createPlatform(5, 1, 2, 6, crouchBaseY, -12); // Platform sàn để đi qua
const ceilingHeight = 0.5;
const gap = playerCrouchHeight + 0.1; // Khoảng trống = chiều cao ngồi + một chút
// Tính toán Y của trần: Y sàn + nửa chiều cao sàn + khoảng trống + nửa chiều cao trần
const ceilingY = crouchBase.position.y + (crouchBase.geometry.parameters.height / 2) + gap + (ceilingHeight / 2);
// Tạo trần nhà
const ceiling = createPlatform(
    crouchBase.geometry.parameters.width, // Rộng bằng sàn
    ceilingHeight,                        // Chiều cao của trần
    crouchBase.geometry.parameters.depth, // Sâu bằng sàn
    crouchBase.position.x,                // Cùng X với sàn
    ceilingY,                             // Vị trí Y đã tính
    crouchBase.position.z,                // Cùng Z với sàn
    obstacleMaterial                      // Vật liệu khác để dễ nhận biết
);
// platforms.push(ceiling); // Hàm createPlatform đã tự push rồi

// 7. Nhảy từ sau khu vực ngồi lên platform nhỏ
createPlatform(1.5, 1, 1.5, 10, 5.5, -12);

// 8. Chuỗi các bước nhảy ngắn (stepping stones) - yêu cầu chính xác
createPlatform(0.8, 0.5, 0.8, 10, 5.7, -15); // Lên cao hơn chút
createPlatform(0.8, 0.5, 0.8, 8, 5.9, -16.5); // Sang trái và lên
createPlatform(0.8, 0.5, 0.8, 6, 6.1, -18);   // Tiếp tục sang trái và lên

// 9. Nhảy xa cuối cùng đến đích
const finalPlatformX = 6;
const finalPlatformY = 7.5;
const finalPlatformZ = -23;
const winPlatform = createPlatform(4, 1, 4, finalPlatformX, finalPlatformY, finalPlatformZ, winPlatformMaterial); // Platform cuối cùng - đặt xa hơn

// Thêm một cái sàn lớn bên dưới (giữ nguyên)
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterialPlane = new THREE.MeshStandardMaterial({ color: 0x999999, side: THREE.DoubleSide }); // Màu khác sàn platform
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterialPlane);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = -10;
groundMesh.receiveShadow = true;
scene.add(groundMesh);
platforms.push(groundMesh); // Thêm sàn vào danh sách platform

// ===========================================================
// === KẾT THÚC PHẦN MAP / PLATFORMS ĐÃ CẬP NHẬT ===
// ===========================================================


// --- Điều khiển ---
// ... (Giữ nguyên phần điều khiển: keys, mouse, pointer lock) ...
const keys = {};
document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (event.code === 'Space' || event.code === 'ShiftLeft') event.preventDefault();
    if (event.code === 'Escape') document.exitPointerLock();
});
document.addEventListener('keyup', (event) => { keys[event.code] = false; });

let cameraYaw = Math.PI;
let cameraPitch = 0;
const mouseSensitivity = 0.002;
const cameraDistance = 4;
const minPitch = -Math.PI / 2 + 0.2;
const maxPitch = Math.PI / 2 - 0.2;
const lookAtHeightOffset = 0.8;
const upDirection = new THREE.Vector3(0, 1, 0);
let isPointerLocked = false;

function onMouseMove(event) { /* ... giữ nguyên ... */
    if (!isPointerLocked) return;
    cameraYaw -= event.movementX * mouseSensitivity;
    cameraPitch -= event.movementY * mouseSensitivity;
    cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
}
function lockPointer() { /* ... giữ nguyên ... */ renderer.domElement.requestPointerLock(); }
function onPointerLockChange() { /* ... giữ nguyên ... */
    if (document.pointerLockElement === renderer.domElement) {
        isPointerLocked = true;
        document.addEventListener('mousemove', onMouseMove, false);
    } else {
        isPointerLocked = false;
        document.removeEventListener('mousemove', onMouseMove, false);
        Object.keys(keys).forEach(key => keys[key] = false);
    }
}
function onPointerLockError() { /* ... giữ nguyên ... */
    console.error('Pointer Lock Error');
    isPointerLocked = false;
}
renderer.domElement.addEventListener('click', lockPointer);
document.addEventListener('pointerlockchange', onPointerLockChange, false);
document.addEventListener('pointerlockerror', onPointerLockError, false);


// --- Raycaster ---
// ... (Giữ nguyên phần Raycaster) ...
const downRaycaster = new THREE.Raycaster();
const standUpRaycaster = new THREE.Raycaster();
const downDirection = new THREE.Vector3(0, -1, 0);


// --- Vòng lặp Game ---
// ... (Giữ nguyên toàn bộ vòng lặp game animate()) ...
const clock = new THREE.Clock();
let gameOver = false;
let animationFrameId;

function animate() {
    if (gameOver) {
        cancelAnimationFrame(animationFrameId);
        return;
    }

    animationFrameId = requestAnimationFrame(animate);
    const deltaTime = Math.min(0.05, clock.getDelta());

    // --- Input & Chuyển động Ngang ---
    const currentSpeed = isCrouching ? playerSpeed * crouchSpeedMultiplier : playerSpeed;
    const moveDirectionInput = new THREE.Vector3();
    if (isPointerLocked) {
        if (keys['KeyW']) moveDirectionInput.z -= 1;
        if (keys['KeyS']) moveDirectionInput.z += 1;
        if (keys['KeyA']) moveDirectionInput.x -= 1;
        if (keys['KeyD']) moveDirectionInput.x += 1;
    }

    // Xử lý Ngồi (Shift)
    const currentHeight = isCrouching ? playerCrouchHeight : playerHeight;
    if (isPointerLocked && keys['ShiftLeft'] && !isCrouching && onGround) {
        isCrouching = true;
        player.scale.y = playerCrouchHeight / playerHeight;
        player.position.y -= (playerHeight - playerCrouchHeight) / 2;
    } else if ((!keys['ShiftLeft'] || !isPointerLocked) && isCrouching) {
        // Kiểm tra đứng dậy
        const standUpOrigin = player.position.clone();
        // *** Quan trọng: Điểm bắt đầu ray kiểm tra đứng dậy phải chính xác ***
        // Bắt đầu từ gần đỉnh đầu khi đang ngồi
        standUpOrigin.y += (playerCrouchHeight / 2) - 0.1;
        const standUpCheckDistance = playerHeight - playerCrouchHeight + 0.15; // Khoảng cách kiểm tra = phần chiều cao tăng lên + đệm nhỏ
        standUpRaycaster.set(standUpOrigin, upDirection);
        // *** Kiểm tra va chạm với TẤT CẢ các platform (bao gồm cả trần nhà) ***
        const standUpIntersects = standUpRaycaster.intersectObjects(platforms);
        let canStandUp = true;
        if (standUpIntersects.length > 0 && standUpIntersects[0].distance < standUpCheckDistance) {
             // console.log("Cannot stand up, distance:", standUpIntersects[0].distance.toFixed(2), "object:", standUpIntersects[0].object.uuid);
            canStandUp = false; // Có vật cản phía trên trong khoảng cách cần đứng dậy
        }

        if (canStandUp) {
            isCrouching = false;
            player.scale.y = 1;
            player.position.y += (playerHeight - playerCrouchHeight) / 2;
        }
    }

    // Tính toán hướng di chuyển ngang
    const worldMoveDirection = new THREE.Vector3();
    if (moveDirectionInput.lengthSq() > 0) {
        moveDirectionInput.normalize();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        const rightDirection = new THREE.Vector3().crossVectors(upDirection, cameraDirection).normalize();
        worldMoveDirection
             .addScaledVector(cameraDirection, -moveDirectionInput.z)
             .addScaledVector(rightDirection, -moveDirectionInput.x);
        worldMoveDirection.normalize();
        playerVelocity.x = worldMoveDirection.x * currentSpeed;
        playerVelocity.z = worldMoveDirection.z * currentSpeed;
    } else {
        // Ma sát
        const friction = 0.92;
        playerVelocity.x *= friction;
        playerVelocity.z *= friction;
        if (Math.abs(playerVelocity.x) < 0.01) playerVelocity.x = 0;
        if (Math.abs(playerVelocity.z) < 0.01) playerVelocity.z = 0;
    }

    // --- Xử lý Nhảy ---
    if (isPointerLocked && keys['Space'] && onGround && !isCrouching) {
        playerVelocity.y = jumpStrength;
        onGround = false;
    }

    // --- Vật lý và Va chạm đất (Giữ nguyên logic từ phiên bản trước hoạt động tốt) ---
    if (!onGround) {
        playerVelocity.y += gravity * deltaTime;
    } else {
        playerVelocity.y = Math.max(0, playerVelocity.y);
    }
    player.position.x += playerVelocity.x * deltaTime;
    player.position.z += playerVelocity.z * deltaTime;
    const deltaY = playerVelocity.y * deltaTime;
    const predictedY = player.position.y + deltaY;
    const rayOrigin = player.position.clone();
    downRaycaster.set(rayOrigin, downDirection);
    const intersects = downRaycaster.intersectObjects(platforms);
    let foundGround = false;
    onGround = false;
    if (intersects.length > 0) {
        const distanceToGround = intersects[0].distance;
        const groundThreshold = currentHeight / 2 + 0.1;
        if (distanceToGround <= groundThreshold && playerVelocity.y <= 0) {
            const groundY = intersects[0].point.y;
            const targetPlayerY = groundY + currentHeight / 2;
            if (predictedY <= targetPlayerY + 0.01) {
                player.position.y = targetPlayerY;
                playerVelocity.y = 0;
                onGround = true;
                foundGround = true;
                // Kiểm tra thắng (Sử dụng biến winPlatform đã được cập nhật vị trí)
                if (intersects[0].object === winPlatform && !gameOver) {
                    console.log("WIN!");
                    document.getElementById('winMessage').style.display = 'block';
                    gameOver = true;
                    if (isPointerLocked) document.exitPointerLock();
                }
            } else {
                 player.position.y = predictedY;
            }
        } else {
             player.position.y = predictedY;
        }
    } else {
        player.position.y = predictedY;
        onGround = false;
    }

    // Xử lý rơi xuống khỏi map
    if (player.position.y < -5) {
        player.position.set(0, playerHeight / 2 + 1, 3); // Reset vị trí về gần platform đầu
        playerVelocity.set(0, 0, 0);
        onGround = false;
        isCrouching = false;
        player.scale.y = 1;
        // Reset camera view?
        // cameraYaw = Math.PI;
        // cameraPitch = 0;
    }

    // --- Cập nhật Camera ---
    // ... (Giữ nguyên phần cập nhật camera) ...
    const cameraOffset = new THREE.Vector3(0, 0, cameraDistance);
    cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch);
    cameraOffset.applyAxisAngle(upDirection, cameraYaw);
    const targetCameraPosition = player.position.clone().add(cameraOffset);
    camera.position.lerp(targetCameraPosition, 0.15);
    const lookAtPosition = player.position.clone();
    lookAtPosition.y += isCrouching ? (playerCrouchHeight * 0.5) : lookAtHeightOffset;
    camera.lookAt(lookAtPosition);


    // --- Render ---
    renderer.render(scene, camera);
} // Kết thúc hàm animate


// --- Xử lý thay đổi kích thước cửa sổ ---
// ... (Giữ nguyên) ...
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Bắt đầu Game ---
console.log("Click the screen to lock pointer and play.");
animate();