// Seed data for job applications
export const applicationsData = [
  {
    jobId: 0, // Will be replaced with actual job ObjectId
    teacherId: 0, // Will be replaced with actual teacher ObjectId
    teacherName: 'Amit Kumar',
    instituteId: 0, // Will be replaced with actual institute ObjectId
    instituteName: 'Delhi Public School, R.K. Puram',
    coverLetter: `Dear Hiring Manager,

I am writing to express my strong interest in the Senior Mathematics Teacher position at Delhi Public School. With 7 years of dedicated teaching experience and expertise in CBSE mathematics curriculum, I believe I would be a valuable addition to your team.

My qualifications include:
- M.Sc. Mathematics with distinction
- B.Ed from Delhi University
- CTET certified and TET qualified
- Published research on mathematical pedagogy

I have a proven track record of helping students score 95%+ in board exams and preparing them for competitive exams like JEE and NEET. I am passionate about making mathematics engaging and accessible to all students.

I would welcome the opportunity to discuss how my skills and experience align with your institution's needs.

Sincerely,
Amit Kumar`,
    status: 'pending',
    appliedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    jobId: 0,
    teacherId: 1,
    teacherName: 'Priya Sharma',
    instituteId: 0,
    instituteName: 'Delhi Public School, R.K. Puram',
    coverLetter: `Dear Sir/Madam,

I am an experienced mathematics educator with 9 years of teaching experience in CBSE and ICSE schools. I have successfully mentored over 500 students, with a 98% pass rate and numerous merit rank holders.

I am particularly interested in the Senior Mathematics Teacher position at Delhi Public School due to your institution's outstanding reputation for academic excellence and holistic development.

My expertise includes:
- Advanced mathematics and calculus
- Competitive exam coaching (JEE, NEET)
- Innovative teaching methodologies
- Digital learning tools integration
- Student mentorship and career guidance

I am confident that my experience and passion for teaching would make me a strong candidate for this position.

Best regards,
Priya Sharma`,
    status: 'reviewed',
    appliedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    jobId: 0,
    teacherId: 2,
    teacherName: 'Rajesh Singh',
    instituteId: 0,
    instituteName: 'Delhi Public School, R.K. Puram',
    coverLetter: `Dear Hiring Committee,

I am excited to apply for the Senior Mathematics Teacher role at DPS. With 6 years of experience in teaching high school mathematics, I have consistently helped students achieve excellent results.

During my tenure at XYZ International School, I:
- Achieved 100% pass rate in mathematics
- Led the mathematics department for curriculum development
- Implemented modern teaching aids and interactive sessions
- Mentored junior teachers

I am eager to bring my expertise to your esteemed institution.

Respectfully,
Rajesh Singh`,
    status: 'shortlisted',
    appliedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },

  // Applications for English Teacher position
  {
    jobId: 1, // Will be replaced with English Teacher job ObjectId
    teacherId: 3,
    teacherName: 'Anjali Verma',
    instituteId: 1, // Will be replaced with KV Bandra ObjectId
    instituteName: 'Kendriya Vidyalaya, Bandra',
    coverLetter: `Dear Selection Committee,

I am a passionate English educator with 4 years of experience in teaching primary classes (1-5). I have developed a keen interest in making English language learning fun and interactive for young learners.

In my previous role at ABC School, I:
- Designed engaging lesson plans with storytelling and creative activities
- Implemented reading clubs and literary competitions
- Achieved 95% student proficiency in reading and writing
- Collaborated with parents for home-school learning continuity

I am particularly drawn to Kendriya Vidyalaya's commitment to holistic education and would be honored to contribute to your institution.

Warm regards,
Anjali Verma`,
    status: 'pending',
    appliedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    jobId: 1,
    teacherId: 4,
    teacherName: 'Divya Nair',
    instituteId: 1,
    instituteName: 'Kendriya Vidyalaya, Bandra',
    coverLetter: `Dear Hiring Manager,

With 5 years of primary education experience, I am confident in my ability to effectively teach English to young learners at Kendriya Vidyalaya.

My background includes:
- B.A. English Literature, B.Ed from Mumbai University
- CTET qualified (Paper 1)
- Experience with CBSE curriculum
- Training in modern pedagogy and inclusive education

I am committed to fostering a love for reading and creative expression in young minds.

Sincerely,
Divya Nair`,
    status: 'shortlisted',
    appliedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },

  // Applications for Science Teacher position (assuming it exists)
  {
    jobId: 2,
    teacherId: 5,
    teacherName: 'Dr. Vikram Gupta',
    instituteId: 2,
    instituteName: 'St. Mary\'s Academy',
    coverLetter: `Dear Principal,

As an experienced Science educator with a Ph.D. in Physics, I am excited about the opportunity to inspire the next generation of scientists at St. Mary's Academy.

My qualifications:
- Ph.D. Physics, M.Sc. Physics Education
- 8 years of high school science teaching
- Published research in physics education
- Expert in practical demonstrations and lab management
- NEET/JEE coaching experience

I believe that science education should be hands-on and engaging, and I have consistently achieved above-average results with my students.

Best regards,
Dr. Vikram Gupta`,
    status: 'reviewed',
    appliedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    jobId: 2,
    teacherId: 6,
    teacherName: 'Neha Patel',
    instituteId: 2,
    instituteName: 'St. Mary\'s Academy',
    coverLetter: `Dear Hiring Committee,

I am a dedicated Science teacher with 5 years of experience in ICSE schools. My passion for making science accessible and exciting to all students aligns well with your institution's values.

Key achievements:
- 98% pass rate in science subjects
- Development of interactive science labs
- Mentoring of 25+ students for science competitions
- CTET qualification

I am confident I can make a meaningful contribution to St. Mary's Academy.

Respectfully,
Neha Patel`,
    status: 'pending',
    appliedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },

  // Additional applications for diversity
  {
    jobId: 3,
    teacherId: 7,
    teacherName: 'Suresh Thakur',
    instituteId: 3,
    instituteName: 'Delhi Public School, Mathura Road',
    coverLetter: `Dear Selection Team,

I am applying for the Hindi Teacher position at DPS Mathura Road. With 6 years of experience teaching Hindi literature and grammar at the secondary level, I am confident in my ability to make Hindi engaging for students.

Expertise:
- Deep knowledge of Hindi literature and Ashually Vyakaran
- Student-centric teaching approach
- Excellent performance in board exams
- Participation in literary festivals and competitions

I look forward to contributing to your institution.

Regards,
Suresh Thakur`,
    status: 'pending',
    appliedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    jobId: 4,
    teacherId: 8,
    teacherName: 'Meera Desai',
    instituteId: 4,
    instituteName: 'DY Patil International School',
    coverLetter: `Dear Hiring Manager,

I am an accomplished Computer Science educator with 7 years of experience teaching coding and computer fundamentals to secondary and senior secondary students.

My expertise includes:
- Python, Java, and C++ programming
- Web development and database management
- Curriculum design aligned with CBSE standards
- Student projects on AI and IoT
- Coding competition mentoring

I am excited about the opportunity to nurture tech-savvy minds at DY Patil.

Best regards,
Meera Desai`,
    status: 'shortlisted',
    appliedDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    jobId: 5,
    teacherId: 9,
    teacherName: 'Arjun Malhotra',
    instituteId: 5,
    instituteName: 'Army Public School',
    coverLetter: `Dear Principal,

As a Physical Education specialist with 5 years of experience, I am keen to contribute to the holistic development of students at Army Public School.

My qualifications:
- B.P.Ed, M.P.Ed (Sports Psychology)
- National sports competencies
- Experience with school sports teams and athletics
- Training in yoga and wellness programs
- Passion for discipline and excellence

I would be honored to serve your institution.

Sincerely,
Arjun Malhotra`,
    status: 'reviewed',
    appliedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];
