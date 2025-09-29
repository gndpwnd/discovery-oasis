dev@DB-78GB094:~/discovery-oasis/workaday_autofill$ tree
.
├── application_questions.json
├── content.js
├── detectors
│   └── formDetector.js
├── fillers
│   ├── checkboxFiller.js
│   ├── dateFiller.js
│   ├── dropdownFiller.js
│   ├── multiselectFiller.js
│   ├── radioFIller.js
│   └── textFiller.js
├── manifest.json
├── my_information.json
├── popup.html
├── popup.js
├── prompt.md
├── self_identify.json
├── utils
│   ├── logger.js
│   └── storage.js
├── voluntary_disclosure.json
└── work_experience.json

3 directories, 19 files
dev@DB-78GB094:~/discovery-oasis/workaday_autofill$


I want to make a chrome extension to help me fill out job applicattions, the website i am using, workaday, does not let users save their information when applying to different companies, and it is affecting my ability to apply to more jobs, so i want to be able to save my information into JSON files, and then be able to "detect" a job application form, based on the following

https://flir.wd1.myworkdayjobs.com/en-US/flircareers/job/

at least based on 

myworkdayjobs.com/en-US/flircareers/job/

and also print out the url being used to detect job application form. 

then i want to detect html elements and be able to detect if they are text boxes, dropdowns, buttons, etc... and then no matter what make sure the information from the JSON is entered.

please help me make the chrome extension to be very simple, and help me make it very small and modular so that i can maintain it easier in time:

i already have my JSON files that correspond HTML elements to their information, i just need to make sure that my code will properly find the html elements and detect the form and detect the input type and make sure my data exists in those inputs or is selected properly

Skills:

Linux, Bash, Windows, PowerShell, Python, MacOS, Raspberry Pi, Rust, Golang, JavaScript, CSS, SQL, C, C++, PHP, Git, GitHub, Nginx, WordPress, Kubernetes, Docker, Hugo, Markdown, YAML, MS Word, Excel, PowerPoint, Teams, Microsoft Office Apps, Arduino, Matlab, Ham Radio Technician, ISC2 Certified in Cybersecurity, CompTIA A+, Leadership, Team Collaboration, Problem-solving, Communication, Project Management, Research Skills, Data Analysis, Technical Documentation, Mentoring, Grant Writing, Budget Management, Equipment Management, Training, Safety Management, Risk Assessment, Time Management, Adaptability, Critical Thinking, Innovation, Detail-oriented, Multi-tasking, Quality Assurance, Process Improvement, Teamwork, Organizational Skills, Analytical Thinking, Creative Problem Solving, Strategic Planning, Resource Allocation, Cross-functional Collaboration, Technical Writing, Presentation Skills, Stakeholder Management, Process Optimization, Continuous Improvement, Self-motivated, Results-driven, Robotics, Full-stack Development, AI, Machine Learning, Cybersecurity, OSINT, Systems Engineering, Real-time Systems, Situational Awareness Systems, Aerospace Engineering, Remote Operations, Heavy Machinery Operation, Wilderness Safety, First Aid, CPR, Trail Construction, Web Development, Database Management, API Development, Data Visualization, Automated Testing, Web Scraping, Report Generation, Network Analysis, Sensor Integration, Quaternion Mathematics, Flask, HTML, PostgreSQL, Qdrant, Neo4j, Docker Compose, Google Dorking, Documentation Writing

