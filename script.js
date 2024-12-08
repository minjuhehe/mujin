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
