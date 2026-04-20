const button = document.getElementById("load-apps");
const output = document.getElementById("output");

button?.addEventListener("click", async () => {
  output.textContent = "Loading...";
  try {
    const response = await fetch("http://localhost:5051/api/applications");
    const data = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = "Could not load applications. Is backend running on port 5051?";
  }
});
