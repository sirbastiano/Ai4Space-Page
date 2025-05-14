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
