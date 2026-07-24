// Premium Resume Builder Frontend Handler

// Local State
let resumeData = {
    personal: {
        name: "",
        title: "",
        email: "",
        phone: "",
        linkedin: "",
        github: ""
    },
    summary: "",
    experience: [],
    projects: [],
    education: [],
    skills: {
        tech: "",
        soft: ""
    }
};

let activeTemplate = "minimalist";
let activeAccentColor = "#8A49FF";

// Initialize
window.addEventListener("DOMContentLoaded", () => {
    setupWizardNavigation();
    setupColorPicker();
    setupTemplateSelector();
    setupRealtimeBindings();
    setupCardSelection();
    
    // Add default initial items
    addExperienceItem();
    addProjectItem();
    addEducationItem();

    // Try loading initial profile data from Firebase if logged in
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadUserProfile(user);
        }
    });

    renderResumePreview();
});

// Setup Template Selection Grid listeners
function setupCardSelection() {
    const cards = document.querySelectorAll(".template-card");
    cards.forEach(card => {
        card.addEventListener("click", () => {
            const template = card.dataset.template;
            window.selectTemplateAndLaunch(template);
        });
    });
}

window.selectTemplateAndLaunch = function(templateName) {
    activeTemplate = templateName;
    
    // Update select element value
    const select = document.getElementById("template-select");
    if (select) select.value = templateName;
    
    // Set preview classes
    const sheet = document.getElementById("resume-a4-sheet");
    if (sheet) sheet.className = `resume-sheet ${templateName}`;
    
    // Transitions
    document.getElementById("template-selection-screen").style.display = "none";
    
    const workspace = document.getElementById("editor-workspace");
    workspace.style.display = "flex";
    
    renderResumePreview();
};

window.backToTemplates = function() {
    document.getElementById("editor-workspace").style.display = "none";
    document.getElementById("template-selection-screen").style.display = "block";
};

// Setup Form Tabs
function setupWizardNavigation() {
    const tabs = document.querySelectorAll(".wizard-tab-link");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            const targetPaneId = "pane-" + tab.dataset.tab;
            const panes = document.querySelectorAll(".wizard-pane");
            panes.forEach(pane => {
                pane.classList.remove("active");
                if (pane.id === targetPaneId) {
                    pane.classList.add("active");
                }
            });
        });
    });
}

// Setup Accent Color Selection
function setupColorPicker() {
    const colorOpts = document.querySelectorAll(".color-opt");
    colorOpts.forEach(opt => {
        opt.addEventListener("click", () => {
            colorOpts.forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            activeAccentColor = opt.dataset.color;
            document.documentElement.style.setProperty("--accent-color", activeAccentColor);
            renderResumePreview();
        });
    });
}

// Setup Layout Template Selection
function setupTemplateSelector() {
    const select = document.getElementById("template-select");
    if (select) {
        select.addEventListener("change", (e) => {
            activeTemplate = e.target.value;
            const sheet = document.getElementById("resume-a4-sheet");
            if (sheet) {
                sheet.className = `resume-sheet ${activeTemplate}`;
            }
            renderResumePreview();
        });
    }
}

// Bind basic text fields for instant live preview updates
function setupRealtimeBindings() {
    const bindings = [
        { id: "in-name", target: "name", section: "personal" },
        { id: "in-title", target: "title", section: "personal" },
        { id: "in-email", target: "email", section: "personal" },
        { id: "in-phone", target: "phone", section: "personal" },
        { id: "in-linkedin", target: "linkedin", section: "personal" },
        { id: "in-github", target: "github", section: "personal" }
    ];

    bindings.forEach(bind => {
        const el = document.getElementById(bind.id);
        if (el) {
            el.addEventListener("input", (e) => {
                resumeData[bind.section][bind.target] = e.target.value;
                renderResumePreview();
            });
        }
    });

    const summaryTextarea = document.getElementById("in-summary");
    if (summaryTextarea) {
        summaryTextarea.addEventListener("input", (e) => {
            resumeData.summary = e.target.value;
            renderResumePreview();
        });
    }

    const techSkills = document.getElementById("in-skills-tech");
    if (techSkills) {
        techSkills.addEventListener("input", (e) => {
            resumeData.skills.tech = e.target.value;
            renderResumePreview();
        });
    }

    const softSkills = document.getElementById("in-skills-soft");
    if (softSkills) {
        softSkills.addEventListener("input", (e) => {
            resumeData.skills.soft = e.target.value;
            renderResumePreview();
        });
    }
}

// Experience items management
function addExperienceItem() {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const container = document.getElementById("experience-list");
    if (!container) return;

    const item = {
        id: id,
        company: "",
        role: "",
        dates: "",
        bullets: ""
    };
    resumeData.experience.push(item);

    const div = document.createElement("div");
    div.className = "dynamic-item-card";
    div.id = `exp-${id}`;
    div.innerHTML = `
        <button class="delete-item-btn" onclick="deleteExperienceItem('${id}')"><i class="fas fa-trash-alt"></i></button>
        <div class="form-grid">
            <div class="form-group"><label>Company / Organization</label><input type="text" placeholder="e.g. Acme Corp" oninput="updateExperience('${id}', 'company', this.value)"></div>
            <div class="form-group"><label>Job Title / Role</label><input type="text" placeholder="e.g. Lead Developer" oninput="updateExperience('${id}', 'role', this.value)"></div>
            <div class="form-group"><label>Dates / Duration</label><input type="text" placeholder="e.g. Jan 2024 - Present" oninput="updateExperience('${id}', 'dates', this.value)"></div>
            <div class="form-group" style="grid-column: span 2;">
                <label>Job Description / Responsibilities (One per line)</label>
                <textarea rows="3" placeholder="Led developer team of 5 members&#10;Architected cloud databases migration" oninput="updateExperience('${id}', 'bullets', this.value)"></textarea>
            </div>
        </div>
    `;
    container.appendChild(div);
    renderResumePreview();
}

function updateExperience(id, key, value) {
    const idx = resumeData.experience.findIndex(item => item.id === id);
    if (idx !== -1) {
        resumeData.experience[idx][key] = value;
        renderResumePreview();
    }
}

function deleteExperienceItem(id) {
    resumeData.experience = resumeData.experience.filter(item => item.id !== id);
    const el = document.getElementById(`exp-${id}`);
    if (el) el.remove();
    renderResumePreview();
}

// Projects items management
function addProjectItem() {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const container = document.getElementById("projects-list");
    if (!container) return;

    const item = {
        id: id,
        title: "",
        tech: "",
        bullets: ""
    };
    resumeData.projects.push(item);

    const div = document.createElement("div");
    div.className = "dynamic-item-card";
    div.id = `proj-${id}`;
    div.innerHTML = `
        <button class="delete-item-btn" onclick="deleteProjectItem('${id}')"><i class="fas fa-trash-alt"></i></button>
        <div class="form-grid">
            <div class="form-group"><label>Project Name</label><input type="text" placeholder="e.g. AI Career Coach Portal" oninput="updateProject('${id}', 'title', this.value)"></div>
            <div class="form-group"><label>Technologies Used</label><input type="text" placeholder="e.g. React, Python, Firestore" oninput="updateProject('${id}', 'tech', this.value)"></div>
            <div class="form-group" style="grid-column: span 2;">
                <label>Project Details / Key Features (One per line)</label>
                <textarea rows="3" placeholder="Integrated Gemini API for mock interview evaluation&#10;Built interactive resume parsing engine" oninput="updateProject('${id}', 'bullets', this.value)"></textarea>
            </div>
        </div>
    `;
    container.appendChild(div);
    renderResumePreview();
}

function updateProject(id, key, value) {
    const idx = resumeData.projects.findIndex(item => item.id === id);
    if (idx !== -1) {
        resumeData.projects[idx][key] = value;
        renderResumePreview();
    }
}

function deleteProjectItem(id) {
    resumeData.projects = resumeData.projects.filter(item => item.id !== id);
    const el = document.getElementById(`proj-${id}`);
    if (el) el.remove();
    renderResumePreview();
}

// Education items management
function addEducationItem() {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const container = document.getElementById("education-list");
    if (!container) return;

    const item = {
        id: id,
        school: "",
        degree: "",
        dates: "",
        score: ""
    };
    resumeData.education.push(item);

    const div = document.createElement("div");
    div.className = "dynamic-item-card";
    div.id = `edu-${id}`;
    div.innerHTML = `
        <button class="delete-item-btn" onclick="deleteEducationItem('${id}')"><i class="fas fa-trash-alt"></i></button>
        <div class="form-grid">
            <div class="form-group"><label>Institution / University</label><input type="text" placeholder="e.g. Stanford University" oninput="updateEducation('${id}', 'school', this.value)"></div>
            <div class="form-group"><label>Degree / Major</label><input type="text" placeholder="e.g. B.Tech in Computer Science" oninput="updateEducation('${id}', 'degree', this.value)"></div>
            <div class="form-group"><label>Dates / Duration</label><input type="text" placeholder="e.g. 2020 - 2024" oninput="updateEducation('${id}', 'dates', this.value)"></div>
            <div class="form-group"><label>GPA / Grades / Percentage</label><input type="text" placeholder="e.g. 9.1 CGPA" oninput="updateEducation('${id}', 'score', this.value)"></div>
        </div>
    `;
    container.appendChild(div);
    renderResumePreview();
}

function updateEducation(id, key, value) {
    const idx = resumeData.education.findIndex(item => item.id === id);
    if (idx !== -1) {
        resumeData.education[idx][key] = value;
        renderResumePreview();
    }
}

function deleteEducationItem(id) {
    resumeData.education = resumeData.education.filter(item => item.id !== id);
    const el = document.getElementById(`edu-${id}`);
    if (el) el.remove();
    renderResumePreview();
}

// Load current User details if they already parsed a resume
async function loadUserProfile(user) {
    try {
        const idToken = await user.getIdToken();
        const base_api = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
            ? 'http://localhost:8000' 
            : 'https://career-coach-ai-3xap.onrender.com';
        
        const response = await fetch(`${base_api}/api/user/profile`, {
            headers: { Authorization: `Bearer ${idToken}` }
        });
        const data = await response.json();
        if (response.ok && data.resume_content) {
            const rc = data.resume_content;
            
            // Populate Personal
            if (rc.personal_info) {
                const pi = rc.personal_info;
                document.getElementById("in-name").value = pi.name || "";
                document.getElementById("in-title").value = pi.title || "";
                document.getElementById("in-email").value = pi.email || "";
                document.getElementById("in-phone").value = pi.phone || "";
                document.getElementById("in-linkedin").value = pi.linkedin || "";
                document.getElementById("in-github").value = pi.github || "";
                
                resumeData.personal = {
                    name: pi.name || "",
                    title: pi.title || "",
                    email: pi.email || "",
                    phone: pi.phone || "",
                    linkedin: pi.linkedin || "",
                    github: pi.github || ""
                };
            }

            // Populate Summary
            if (rc.summary) {
                document.getElementById("in-summary").value = rc.summary;
                resumeData.summary = rc.summary;
            }

            // Populate Skills
            if (rc.skills) {
                let techSkills = "";
                if (typeof rc.skills === "object" && !Array.isArray(rc.skills)) {
                    techSkills = Object.values(rc.skills).flat().join(", ");
                } else if (Array.isArray(rc.skills)) {
                    techSkills = rc.skills.join(", ");
                } else {
                    techSkills = rc.skills;
                }
                document.getElementById("in-skills-tech").value = techSkills;
                resumeData.skills.tech = techSkills;
            }

            // Populate Experience (work_experience)
            const workExp = rc.work_experience || rc.experience || [];
            if (workExp.length > 0) {
                resumeData.experience = [];
                const expContainer = document.getElementById("experience-list");
                if (expContainer) expContainer.innerHTML = "";

                workExp.forEach(exp => {
                    const bulletsStr = Array.isArray(exp.description) ? exp.description.join("\n") : (exp.description || "");
                    const durationStr = exp.duration || exp.dates || "";
                    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                    const item = {
                        id: id,
                        company: exp.company || "",
                        role: exp.role || "",
                        dates: durationStr,
                        bullets: bulletsStr
                    };
                    resumeData.experience.push(item);
                    
                    const div = document.createElement("div");
                    div.className = "dynamic-item-card";
                    div.id = `exp-${id}`;
                    div.innerHTML = `
                        <button class="delete-item-btn" onclick="deleteExperienceItem('${id}')"><i class="fas fa-trash-alt"></i></button>
                        <div class="form-grid">
                            <div class="form-group"><label>Company / Organization</label><input type="text" placeholder="e.g. Acme Corp" value="${item.company}" oninput="updateExperience('${id}', 'company', this.value)"></div>
                            <div class="form-group"><label>Job Title / Role</label><input type="text" placeholder="e.g. Lead Developer" value="${item.role}" oninput="updateExperience('${id}', 'role', this.value)"></div>
                            <div class="form-group"><label>Dates / Duration</label><input type="text" placeholder="e.g. Jan 2024 - Present" value="${item.dates}" oninput="updateExperience('${id}', 'dates', this.value)"></div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Job Description / Responsibilities (One per line)</label>
                                <textarea rows="3" placeholder="Led developer team of 5 members&#10;Architected cloud databases migration" oninput="updateExperience('${id}', 'bullets', this.value)">${item.bullets}</textarea>
                            </div>
                        </div>
                    `;
                    if (expContainer) expContainer.appendChild(div);
                });
            }

            // Populate Projects
            const projects = rc.projects || [];
            if (projects.length > 0) {
                resumeData.projects = [];
                const projContainer = document.getElementById("projects-list");
                if (projContainer) projContainer.innerHTML = "";

                projects.forEach(proj => {
                    const bulletsStr = Array.isArray(proj.description) ? proj.description.join("\n") : (proj.description || "");
                    const techStr = Array.isArray(proj.technologies) ? proj.technologies.join(", ") : (proj.technologies || proj.tech || "");
                    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                    const item = {
                        id: id,
                        title: proj.title || proj.name || "",
                        tech: techStr,
                        bullets: bulletsStr
                    };
                    resumeData.projects.push(item);
                    
                    const div = document.createElement("div");
                    div.className = "dynamic-item-card";
                    div.id = `proj-${id}`;
                    div.innerHTML = `
                        <button class="delete-item-btn" onclick="deleteProjectItem('${id}')"><i class="fas fa-trash-alt"></i></button>
                        <div class="form-grid">
                            <div class="form-group"><label>Project Name</label><input type="text" placeholder="e.g. AI Career Coach Portal" value="${item.title}" oninput="updateProject('${id}', 'title', this.value)"></div>
                            <div class="form-group"><label>Technologies Used</label><input type="text" placeholder="e.g. React, Python, Firestore" value="${item.tech}" oninput="updateProject('${id}', 'tech', this.value)"></div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Project Details / Key Features (One per line)</label>
                                <textarea rows="3" placeholder="Integrated Gemini API for mock interview evaluation&#10;Built interactive resume parsing engine" oninput="updateProject('${id}', 'bullets', this.value)">${item.bullets}</textarea>
                            </div>
                        </div>
                    `;
                    if (projContainer) projContainer.appendChild(div);
                });
            }

            // Populate Education
            const education = rc.education || [];
            if (education.length > 0) {
                resumeData.education = [];
                const eduContainer = document.getElementById("education-list");
                if (eduContainer) eduContainer.innerHTML = "";

                education.forEach(edu => {
                    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                    const item = {
                        id: id,
                        school: edu.institution || edu.school || "",
                        degree: edu.degree || "",
                        dates: edu.duration || edu.dates || "",
                        score: edu.score || edu.gpa || ""
                    };
                    resumeData.education.push(item);
                    
                    const div = document.createElement("div");
                    div.className = "dynamic-item-card";
                    div.id = `edu-${id}`;
                    div.innerHTML = `
                        <button class="delete-item-btn" onclick="deleteEducationItem('${id}')"><i class="fas fa-trash-alt"></i></button>
                        <div class="form-grid">
                            <div class="form-group"><label>Institution / University</label><input type="text" placeholder="e.g. Stanford University" value="${item.school}" oninput="updateEducation('${id}', 'school', this.value)"></div>
                            <div class="form-group"><label>Degree / Major</label><input type="text" placeholder="e.g. B.Tech in Computer Science" value="${item.degree}" oninput="updateEducation('${id}', 'degree', this.value)"></div>
                            <div class="form-group"><label>Dates / Duration</label><input type="text" placeholder="e.g. 2020 - 2024" value="${item.dates}" oninput="updateEducation('${id}', 'dates', this.value)"></div>
                            <div class="form-group"><label>GPA / Grades / Percentage</label><input type="text" placeholder="e.g. 9.1 CGPA" value="${item.score}" oninput="updateEducation('${id}', 'score', this.value)"></div>
                        </div>
                    `;
                    if (eduContainer) eduContainer.appendChild(div);
                });
            }

            renderResumePreview();
        }
    } catch (e) {
        console.warn("Failed to load user profile data directly into builder:", e);
    }
}

// Smart AI Assistant Suggestion
function generateAISummary() {
    const title = document.getElementById("in-title").value || "Professional";
    const skillList = document.getElementById("in-skills-tech").value || "Software Development";
    
    const summaryTemplates = [
        `Results-driven ${title} with extensive expertise in ${skillList}. Proven track record of designing highly scalable systems, optimizing application performance, and collaborating in agile teams to deliver premium web and software solutions.`,
        `Ambitious and detail-oriented ${title} skilled in ${skillList}. Dedicated to engineering high-quality clean code, solving complex architectural challenges, and implementing modern user-facing designs to accelerate business workflows.`,
        `Dynamic ${title} offering a solid background in ${skillList}. Adept at leading technical development lifecycles, identifying efficiency opportunities, and designing secure, responsive full-stack applications.`
    ];

    const randomSuggestion = summaryTemplates[Math.floor(Math.random() * summaryTemplates.length)];
    const textarea = document.getElementById("in-summary");
    if (textarea) {
        textarea.value = randomSuggestion;
        resumeData.summary = randomSuggestion;
        renderResumePreview();
    }
}

// RENDER RESUME SHEET HTML PREVIEW
function renderResumePreview() {
    const sheet = document.getElementById("resume-a4-sheet");
    if (!sheet) return;

    // Split skill listings
    let techSkillsHtml = "";
    if (resumeData.skills.tech) {
        if (activeTemplate === "developer") {
            const devTags = resumeData.skills.tech.split(",").map(skill => `<span class="dev-tag">${skill.trim()}</span>`).join("");
            techSkillsHtml = `<div class="res-skill-group"><strong>Technical Stack:</strong><div>${devTags}</div></div>`;
        } else {
            techSkillsHtml = `<div class="res-skill-group"><strong>Technical Skills:</strong><span>${resumeData.skills.tech}</span></div>`;
        }
    }

    let softSkillsHtml = "";
    if (resumeData.skills.soft) {
        if (activeTemplate === "developer") {
            const devTags = resumeData.skills.soft.split(",").map(skill => `<span class="dev-tag">${skill.trim()}</span>`).join("");
            softSkillsHtml = `<div class="res-skill-group"><strong>Methodologies & Tools:</strong><div>${devTags}</div></div>`;
        } else {
            softSkillsHtml = `<div class="res-skill-group"><strong>Soft Skills & Tools:</strong><span>${resumeData.skills.soft}</span></div>`;
        }
    }

    // Render Experience List
    let expHtml = "";
    resumeData.experience.forEach(exp => {
        if (!exp.company && !exp.role) return;
        const bullets = exp.bullets.split("\n").filter(b => b.trim() !== "");
        let bulletsHtml = "";
        if (bullets.length > 0) {
            bulletsHtml = `<ul class="res-item-desc">${bullets.map(b => `<li>${b}</li>`).join("")}</ul>`;
        }
        expHtml += `
            <div class="res-item">
                <div class="res-item-header">
                    <span>${exp.role || "Role"}</span>
                    <span>${exp.dates || ""}</span>
                </div>
                <div class="res-item-sub">
                    <span>${exp.company || "Company"}</span>
                </div>
                ${bulletsHtml}
            </div>
        `;
    });

    // Render Projects List
    let projHtml = "";
    resumeData.projects.forEach(proj => {
        if (!proj.title) return;
        const bullets = proj.bullets.split("\n").filter(b => b.trim() !== "");
        let bulletsHtml = "";
        if (bullets.length > 0) {
            bulletsHtml = `<ul class="res-item-desc">${bullets.map(b => `<li>${b}</li>`).join("")}</ul>`;
        }
        const techTag = proj.tech ? ` | <em>${proj.tech}</em>` : "";
        projHtml += `
            <div class="res-item">
                <div class="res-item-header">
                    <span>${proj.title}${techTag}</span>
                </div>
                ${bulletsHtml}
            </div>
        `;
    });

    // Render Education List
    let eduHtml = "";
    resumeData.education.forEach(edu => {
        if (!edu.school && !edu.degree) return;
        eduHtml += `
            <div class="res-item">
                <div class="res-item-header">
                    <span>${edu.school || "Institution"}</span>
                    <span>${edu.dates || ""}</span>
                </div>
                <div class="res-item-sub">
                    <span>${edu.degree || "Degree"}</span>
                    <span>${edu.score || ""}</span>
                </div>
            </div>
        `;
    });

    const contactHtml = `
        <div class="res-contact">
            ${resumeData.personal.email ? `<span><i class="fas fa-envelope"></i> ${resumeData.personal.email}</span>` : ""}
            ${resumeData.personal.phone ? `<span><i class="fas fa-phone"></i> ${resumeData.personal.phone}</span>` : ""}
            ${resumeData.personal.linkedin ? `<span><i class="fab fa-linkedin"></i> ${resumeData.personal.linkedin}</span>` : ""}
            ${resumeData.personal.github ? `<span><i class="fab fa-github"></i> ${resumeData.personal.github}</span>` : ""}
        </div>
    `;

    // Dynamic Sheet Layout by activeTemplate
    if (activeTemplate === "elegant") {
        // Executive Elegant: 2 Column layout
        sheet.innerHTML = `
            <div class="sidebar-col">
                <div class="res-header">
                    <h1 style="color:#FFF;">${resumeData.personal.name || "YOUR NAME"}</h1>
                    <h2 style="color:var(--accent-color); font-size:11pt;">${resumeData.personal.title || ""}</h2>
                </div>
                
                <div class="res-section">
                    <div class="res-section-title">Contact</div>
                    ${contactHtml}
                </div>

                ${(techSkillsHtml || softSkillsHtml) ? `
                <div class="res-section">
                    <div class="res-section-title">Skills</div>
                    <div class="res-skills-grid" style="color: #E2E8F0; display:flex; flex-direction:column; gap:4mm;">
                        ${techSkillsHtml}
                        ${softSkillsHtml}
                    </div>
                </div>` : ""}
            </div>

            <div class="main-col">
                ${resumeData.summary ? `
                <div class="res-section">
                    <div class="res-section-title">Profile Summary</div>
                    <p class="res-summary">${resumeData.summary}</p>
                </div>` : ""}

                ${expHtml ? `
                <div class="res-section">
                    <div class="res-section-title">Professional Experience</div>
                    ${expHtml}
                </div>` : ""}

                ${projHtml ? `
                <div class="res-section">
                    <div class="res-section-title">Projects</div>
                    ${projHtml}
                </div>` : ""}

                ${eduHtml ? `
                <div class="res-section">
                    <div class="res-section-title">Education</div>
                    ${eduHtml}
                </div>` : ""}
            </div>
        `;
    } else {
        // Modern Minimalist / Creative Classic: Single column layout
        sheet.innerHTML = `
            <div class="res-header">
                <h1>${resumeData.personal.name || "YOUR NAME"}</h1>
                <h2>${resumeData.personal.title || ""}</h2>
                ${contactHtml}
            </div>

            ${resumeData.summary ? `
            <div class="res-section">
                <div class="res-section-title">Professional Summary</div>
                <p class="res-summary">${resumeData.summary}</p>
            </div>` : ""}

            ${expHtml ? `
            <div class="res-section">
                <div class="res-section-title">Work Experience</div>
                ${expHtml}
            </div>` : ""}

            ${projHtml ? `
            <div class="res-section">
                <div class="res-section-title">Key Projects</div>
                ${projHtml}
            </div>` : ""}

            ${eduHtml ? `
            <div class="res-section">
                <div class="res-section-title">Education</div>
                ${eduHtml}
            </div>` : ""}

            ${(techSkillsHtml || softSkillsHtml) ? `
            <div class="res-section">
                <div class="res-section-title">Skills Inventory</div>
                <div class="res-skills-grid">
                    ${techSkillsHtml}
                    ${softSkillsHtml}
                </div>
            </div>` : ""}
        `;
    }
}

// HIGH QUALITY CLIENT SIDE PDF DOWNLOAD EXPORT
window.downloadResumePDF = function() {
    const element = document.getElementById("resume-a4-sheet");
    if (!element) return;

    const opt = {
        margin:       [0, 0, 0.5, 0], // Margins (top, left, bottom, right) in inches to prevent top-strap gaps
        filename:     `${resumeData.personal.name || 'Resume'}_AI_Career_Coach.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2.5, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
};
