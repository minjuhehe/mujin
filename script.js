document.addEventListener("DOMContentLoaded", () => {
  console.log("Welcome to My Website!");

  // Add click event to email span
  const emailElement = document.getElementById("email");
  if (emailElement) {
    emailElement.addEventListener("click", () => {
      const email = "mujin7711@gmail.com";
      navigator.clipboard.writeText(email).then(() => {
        alert("Email copied to clipboard!");
      }).catch(err => {
        alert("Failed to copy email.");
        console.error(err);
      });
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  console.log("Welcome to My Website!");

  // Handle Contact Form Submission
  const contactForm = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault(); // ป้องกันการรีเฟรชหน้า
      const name = document.getElementById("name").value;
      const email = document.getElementById("email").value;
      const message = document.getElementById("message").value;

      // Mock Submission (แสดงสถานะการส่ง)
      console.log(`Name: ${name}, Email: ${email}, Message: ${message}`);
      formStatus.style.display = "block";

      // ล้างฟอร์ม
      contactForm.reset();

      // ซ่อนข้อความสถานะหลัง 3 วินาที
      setTimeout(() => {
        formStatus.style.display = "none";
      }, 3000);
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  // Dynamic Quotes
  const quotes = [
    "If the problem is not fix, then keep fixing it - Trin aranphanu",
    "Life is 10% what happens to us and 90% how we react to it. – Charles R. Swindoll",
    "Success is not final, failure is not fatal: It is the courage to continue that counts. – Winston Churchill",
    "Your time is limited, so don’t waste it living someone else’s life. – Steve Jobs",
    "The only way to do great work is to love what you do. – Steve Jobs"
  	“The best way to predict the future is to create it.” – Peter Drucker
	  “Happiness is not something ready made. It comes from your own actions.” – Dalai Lama
		“Do what you can, with what you have, where you are.” – Theodore Roosevelt
		“It always seems impossible until it’s done.” – Nelson Mandela
		“Don’t watch the clock; do what it does. Keep going.” – Sam Levenson
  ];

  const quoteElement = document.getElementById("quote");
  const randomIndex = Math.floor(Math.random() * quotes.length);
  quoteElement.textContent = quotes[randomIndex];
});
function toggleContent(event, contentId, button) {
  event.preventDefault(); // ป้องกันการเปลี่ยนหน้า
  const content = document.getElementById(contentId);

  // ตรวจสอบว่าคอนเทนต์ซ่อนอยู่หรือไม่
  if (content.classList.contains("hidden")) {
    content.classList.remove("hidden");
    content.classList.add("visible");
    button.textContent = "Close"; // เปลี่ยนข้อความปุ่มเป็น Close
  } else {
    content.classList.remove("visible");
    content.classList.add("hidden");
    button.textContent = "Read More"; // เปลี่ยนข้อความปุ่มกลับเป็น Read More
  }
}
function showModal(content) {
  const modal = document.getElementById("modal");
  const modalText = document.getElementById("modalText");
  modalText.textContent = content;
  modal.style.display = "block";
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.style.display = "none";
}
