// check_superadmin.js

document.addEventListener("DOMContentLoaded", async function () {
    const token = await getTokenFromDatabase();

    try {
        const response = await fetch("/check-superadmin", {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Failed to fetch admin status");
        }

        const data = await response.json();

        if (data.is_superadmin) {
            // Проверяем существование элемента перед изменением
            const userListItem = document.getElementById("user-list-item");
            if (userListItem) {
                userListItem.style.display = "block";
            }

            const pendingApprovalItem = document.getElementById("pending-approval-item");
            if (pendingApprovalItem) {
                pendingApprovalItem.style.display = "block";
            }

            const adminOrdersBtn = document.getElementById("adminOrdersBtn");
            if (adminOrdersBtn) {
                adminOrdersBtn.style.display = "inline-block";
            }
        }
    } catch (error) {
        console.error("Error checking super admin status:", error);
    }
});