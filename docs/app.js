const { createApp } = Vue

createApp({
  data() {
    return {
      workshopOverview: 'Loading workshop overview...',
      workshopObjectives: 'Loading workshop objectives...',
      workshopTopics: [],
      invitedSpeakers: [],
      tracks: [],
      challenges: [],
      contact: {
        name: '',
        email: '',
        message: ''
      }
    }
  },
  methods: {
    async fetchAi4SpaceContent() {
      try {
        const response = await fetch('/api/ai4space-content');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.json();
        this.tracks = content.filter(item => item.type === 'Track');
        this.challenges = content.filter(item => item.type === 'Challenge');
      } catch (error) {
        console.error("Could not fetch AI4Space content:", error);
        this.tracks = [];
        this.challenges = [];
      }
    },
    async fetchWorkshopDetails() {
      try {
        const response = await fetch('/api/topics'); // API endpoint for overview, objectives, topics
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.workshopOverview = data.overview;
        this.workshopObjectives = data.objectives;
        this.workshopTopics = data.topics_list;
      } catch (error) {
        console.error("Could not fetch workshop details:", error);
        this.workshopOverview = "Failed to load workshop overview.";
        this.workshopObjectives = "Failed to load workshop objectives.";
        this.workshopTopics = [];
      }
    },
    async fetchInvitedSpeakers() {
      try {
        const response = await fetch('/api/speakers');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.invitedSpeakers = await response.json();
      } catch (error) {
        console.error("Could not fetch invited speakers:", error);
        this.invitedSpeakers = [];
      }
    },
    async submitForm() {
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.contact),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        alert(result.message || `Thank you, ${this.contact.name}! Your message has been received.`);
        this.contact.name = '';
        this.contact.email = '';
        this.contact.message = '';
      } catch (error) {
        console.error("Could not submit contact form:", error);
        alert(`Error submitting form: ${error.message}`);
      }
    }
  },
  mounted() {
    this.fetchAi4SpaceContent();
    this.fetchWorkshopDetails();
    this.fetchInvitedSpeakers();
  }
}).mount('#app')

document.addEventListener('DOMContentLoaded', function() {
  var fadeEls = document.querySelectorAll('.fade-in-section');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    fadeEls.forEach(function(el) {
      observer.observe(el);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    function checkVisibility() {
      fadeEls.forEach(function(el) {
        var rect = el.getBoundingClientRect();
        if (rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0) {
          el.classList.add('visible');
        }
      });
    }
    window.addEventListener('scroll', checkVisibility);
    window.addEventListener('resize', checkVisibility);
    checkVisibility(); // Initial check
  }
});

// Navbar toggle functionality
const menuIcon = document.querySelector('.menu-icon');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-links');

if (menuIcon && navMenu) {
    menuIcon.addEventListener('click', () => {
        // Toggle Nav
        navMenu.classList.toggle('active');

        // Toggle Icon
        menuIcon.classList.toggle('active');
        const icon = menuIcon.querySelector('i');
        if (icon.classList.contains('fa-bars')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

// Close mobile menu when a link is clicked
if (navLinks && navMenu && menuIcon) {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                menuIcon.classList.remove('active');
                const icon = menuIcon.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });
}
