// Frontend integration for portfolio publishing (Merged Logic)
class PortfolioPublisher {
  constructor(apiBaseUrl = "https://career-coach-ai-3xap.onrender.com/api/portfolio") {
    this.apiBaseUrl = apiBaseUrl;
  }

  async publishPortfolio(portfolioData, preferredSlug = null) {
    try {
      const idToken = await firebase.auth().currentUser.getIdToken();
      // Add preferred slug to the data
      const publishData = {
        ...portfolioData,
        preferredSlug: preferredSlug,
      };

      const response = await fetch(`${this.apiBaseUrl}/publish-portfolio`, {
        method: "POST",
        headers: {
            'Authorization': `Bearer ${idToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(publishData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to publish portfolio");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Publishing error:", error);
      throw error;
    }
  }

  generateSlugFromName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }
}

class PortfolioGenerator {
    constructor() {
      this.resumeFile = null;
      this.portfolioData = null;
      this.selectedTemplate = "creative"; // Default
      // CHANGED: Point to PRODUCTION backend for deployment
      this.apiBaseUrl = "https://career-coach-ai-3xap.onrender.com/api/portfolio"; 
      this.init();
    }
  
    init() {
      this.bindEvents();
    }
  
    bindEvents() {
      // File upload events
      const uploadArea = document.getElementById("upload-area");
      const fileInput = document.getElementById("resume-file");
      const uploadNextBtn = document.getElementById("upload-next-btn");
      const backToUploadBtn = document.getElementById("back-to-upload");
      const generateBtn = document.getElementById("generate-btn");
  
      // Upload area click
      uploadArea.addEventListener("click", () => fileInput.click());
  
      // File input change
      fileInput.addEventListener("change", (e) =>
        this.handleFileSelect(e.target.files[0])
      );
  
      // Drag and drop
      uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
      });
  
      uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
      });
  
      uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        this.handleFileSelect(e.dataTransfer.files[0]);
      });

      // Navigation Buttons
      if(uploadNextBtn) {
          uploadNextBtn.addEventListener("click", () => this.showSection("template"));
      }

      if(backToUploadBtn) {
          backToUploadBtn.addEventListener("click", () => this.showSection("upload"));
      }
  
      // Template Selection
      document.querySelectorAll(".template-option").forEach(option => {
          option.addEventListener("click", () => {
              // Remove selected class from all
              document.querySelectorAll(".template-option").forEach(opt => opt.classList.remove("selected"));
              // Add to clicked
              option.classList.add("selected");
              // Update state
              this.selectedTemplate = option.dataset.template;
              console.log("Selected Template:", this.selectedTemplate);
              
              // NEW: Auto-refresh if data exists
              if(this.portfolioData) {
                  this.refreshPreview();
              }
          });
      });
  
      // Generate button
      generateBtn.addEventListener("click", () => this.generatePortfolio());
  
      // Preview controls
      const publishBtn = document.getElementById("publish-btn");
      if(publishBtn) publishBtn.addEventListener("click", () => this.publishPortfolio());
      
      const downloadBtn = document.getElementById("download-btn");
      if(downloadBtn) downloadBtn.addEventListener("click", () => this.downloadPortfolio());
      
      const newBtn = document.getElementById("new-btn");
      if(newBtn) newBtn.addEventListener("click", () => this.resetGenerator());

      const refreshBtn = document.getElementById("refresh-btn");
      if(refreshBtn) refreshBtn.addEventListener("click", () => this.refreshPreview());
    }
  
    handleFileSelect(file) {
      if (!file) return;
  
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
  
      if (!allowedTypes.includes(file.type)) {
        this.showError("Please select a PDF, DOC, DOCX, or TXT file.");
        return;
      }
  
      this.resumeFile = file;
      this.updateUploadArea();
      this.updateNextButton();
    }
  
    updateUploadArea() {
      const uploadArea = document.getElementById("upload-area");
      const uploadContent = uploadArea.querySelector(".upload-content");
  
      if (this.resumeFile) {
        uploadArea.classList.add("file-selected");
        uploadContent.innerHTML = `
                  <i class="fas fa-file-check"></i>
                  <h3>File Selected</h3>
                  <p>${this.resumeFile.name}</p>
              `;
      }
    }
  
    updateNextButton() {
      const btn = document.getElementById("upload-next-btn");
      if(btn) btn.disabled = !this.resumeFile;
    }
  
    async refreshPreview() {
      try {
          console.log("Refreshing preview with template:", this.selectedTemplate);
          const response = await fetch(`${this.apiBaseUrl}/render-template`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  data: this.portfolioData,
                  template: this.selectedTemplate
              })
          });
          
          if (!response.ok) throw new Error("Failed to render template");
          
          const result = await response.json();
          this.showPortfolioPreview(result.html_content);
          
      } catch (error) {
          console.error("Preview refresh failed:", error);
          // Don't show full error UI, just log it, as it's a background update
      }
    }

    async generatePortfolio() {
      try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        this.showSection("loading");
  
        // Step 1: Upload and extract text from file
        this.updateLoadingText("Processing resume file...");
        const formData = new FormData();
        formData.append("file", this.resumeFile);
  
        const uploadResponse = await fetch(
          `${this.apiBaseUrl}/upload-resume`,
          {
            method: "POST",
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: formData,
          }
        );
  
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.detail || "Failed to process resume file");
        }
  
        const uploadResult = await uploadResponse.json();
        console.log(
          `Extracted ${uploadResult.text_length} characters from ${uploadResult.filename}`
        );
  
        // Step 2: Generate portfolio from extracted text
        this.updateLoadingText("Generating portfolio with AI...");
        const generateResponse = await fetch(
          `${this.apiBaseUrl}/generate-from-text`,
          {
            method: "POST",
            headers: {
                'Authorization': `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: uploadResult.extracted_text,
              filename: uploadResult.filename,
              template: this.selectedTemplate // Pass selected template
            }),
          }
        );
  
        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.detail || "Failed to generate portfolio");
        }
  
        const result = await generateResponse.json();
        console.log(
          `Portfolio generated with ${result.skills_extracted} skills, ${result.experience_count} experiences`
        );
  
        // Step 3: Show preview
        this.updateLoadingText("Finalizing your portfolio...");
        this.portfolioData = result.portfolio_data;
        await this.showPortfolioPreview(result.html_content);
      } catch (error) {
        console.error("Error generating portfolio:", error);
        this.showError("Failed to generate portfolio: " + error.message);
        this.showSection("upload");
      }
    }
  
  
    async showPortfolioPreview(htmlContent) {
      console.log("Showing portfolio preview, HTML length:", htmlContent.length);
  
      // Validate HTML content
      if (!htmlContent || htmlContent.length < 100) {
        throw new Error("Generated HTML is too short or empty");
      }
  
      try {
        // Create a blob URL for the HTML content
        const blob = new Blob([htmlContent], { type: "text/html" });
        const url = URL.createObjectURL(blob);
  
        // Store the HTML for download
        this.portfolioHTML = htmlContent;
  
        // Show preview
        const iframe = document.getElementById("portfolio-preview");
        iframe.src = url;
        this.showSection("preview");
  
        // Clean up the blob URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (error) {
        console.error("Error creating portfolio preview:", error);
        throw new Error("Failed to create portfolio preview: " + error.message);
      }
    }
  
    downloadPortfolio() {
      if (!this.portfolioHTML) return;
  
      const blob = new Blob([this.portfolioHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
  
      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  
      URL.revokeObjectURL(url);
    }
  
    async publishPortfolio() {
        if (!this.portfolioData) {
          this.showError("No portfolio data available. Generate portfolio first.");
          return;
        }
        
        const publisher = new PortfolioPublisher();
        
        try {
            this.updateLoadingText("Publishing to GitHub Pages...");
            this.showSection("loading");

            // Use name as base slug
            const slug = publisher.generateSlugFromName(this.portfolioData.personalInfo.name || "portfolio");
            
            const result = await publisher.publishPortfolio({
                ...this.portfolioData,
                template: this.selectedTemplate
            }, slug);
            
            this.showPublishSuccess(result);
            this.showSection("preview");
            
        } catch (error) {
            console.error("Publishing failed:", error);
            this.showError(`Publishing failed: ${error.message}`);
            this.showSection("preview");
        }
    }

    showPublishSuccess(result) {
        const successModal = document.createElement("div");
        successModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;";
        successModal.innerHTML = `
            <div style="background: rgba(30, 41, 59, 0.9); backdrop-filter: blur(20px); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3rem; text-align: center; color: white; max-width: 500px; margin: 2rem;">
                <i class="fas fa-check-circle" style="font-size: 4rem; color: #4CAF50; margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 1rem;">Portfolio Published Successfully!</h2>
                <p style="margin-bottom: 2rem; opacity: 0.9;">Your portfolio is now live on GitHub Pages</p>
                <div style="background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 10px; margin-bottom: 2rem; word-break: break-all;">
                    <strong>Live URL:</strong><br>
                    <a href="${result.url}" target="_blank" style="color: #4CAF50; text-decoration: none;">${result.url}</a>
                </div>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="window.open('${result.url}', '_blank')" style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; padding: 1rem 2rem; border-radius: 10px; cursor: pointer; font-weight: 600;">View Portfolio</button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: rgba(255, 255, 255, 0.2); color: white; border: none; padding: 1rem 2rem; border-radius: 10px; cursor: pointer; font-weight: 600;">Close</button>
                </div>
            </div>`;
        document.body.appendChild(successModal);
        setTimeout(() => successModal.remove(), 30000);
    }
  
    resetGenerator() {
      this.resumeFile = null;
      this.portfolioHTML = null;
  
      // Reset upload area
      const uploadArea = document.getElementById("upload-area");
      const uploadContent = uploadArea.querySelector(".upload-content");
      uploadArea.classList.remove("file-selected");
      uploadContent.innerHTML = `
              <i class="fas fa-cloud-upload-alt"></i>
              <h3>Drop your resume here</h3>
              <p>or click to browse files</p>
          `;
  
      // Reset file input
      document.getElementById("resume-file").value = "";
  
      // Update button state
      this.updateGenerateButton();
  
      // Show upload section
      this.showSection("upload");
    }
  
    showSection(sectionName) {
      document.querySelectorAll(".section").forEach((section) => {
        section.classList.remove("active");
      });
      document.getElementById(`${sectionName}-section`).classList.add("active");

      // Handle Container Width
      const container = document.querySelector(".container");
      if (sectionName === "preview") {
          container.classList.add("wide-mode");
      } else {
          container.classList.remove("wide-mode");
      }
    }
  
    updateLoadingText(text) {
      document.getElementById("loading-text").textContent = text;
    }
  
    showError(message) {
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = `position: fixed; top: 20px; right: 20px; background: rgba(255, 59, 48, 0.9); color: white; padding: 1rem 1.5rem; border-radius: 10px; backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.2); z-index: 10000; max-width: 400px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);`;
      errorDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><i class="fas fa-exclamation-triangle"></i><span>${message}</span><button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: auto; font-size: 18px;">&times;</button></div>`;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }
  
  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    new PortfolioGenerator();
  });