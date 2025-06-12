# Jira Team Dashboard

A dynamic and interactive web application for visualizing Jira project data, focusing on team workload, task timelines, and various data aggregations. This dashboard connects to the Jira Cloud API via a simple Node.js proxy to provide real-time insights without exposing sensitive API tokens on the client-side.

## Key Features

- **Multiple Data Views**: Visualize your project data in various ways to suit your needs.
  - **Gantt Chart**: A detailed timeline view of all tasks with dependencies and progress. Includes a compact mode for a high-level overview.
  - **By Time**: See recently created tasks, recently updated tasks (with details of the change), and tasks that have had no action for over 7 days.
  - **By Status**: A Kanban-style board with columns for each status, arranged logically (`Open` > `Pending` > `Done`).
  - **By Team / Assignee**: View all tasks grouped by the person they are assigned to.
  - **By Department / BI Category**: Group tasks based on custom fields to understand workload distribution.
  - **By Label**: A leaderboard view showing the most used labels and the assignees associated with them.

- **Interactive Task Management**:
  - **Task Detail Drawer**: Click on any task to open a detailed side panel with full descriptions, comments, and a complete, filterable change history.
  - **Direct Jira Actions**: Update tasks directly from the dashboard.
    - Change Status
    - Change Priority
    - Change BI Category
    - Add new comments
  - **Deselectable Actions**: Cancel a pending change in the "Actions" tab before updating.

- **Dynamic & Live Data**:
  - **Auto-Refresh**: The dashboard automatically fetches the latest data from Jira every 10 minutes during working hours (8:00 - 19:00 BKK time) without needing a manual refresh.
  - **LIVE Indicator**: A "LIVE" badge appears during working hours to indicate that auto-refresh is active.
  - **Last Refresh Timestamp**: Always know when your data was last synced.

- **Powerful Filtering & Sorting**:
  - Filter tasks by name, ID, date range, assignee, status, department, and more.
  - A sophisticated multi-level sorting system organizes tasks logically based on their status, priority, and due date.


## Tech Stack

- **Frontend**:
  - [React](https://reactjs.org/)
  - [Recharts](https://recharts.org/): For interactive charts
  - [Lucide React](https://lucide.dev/): For icons
  - [Tailwind CSS](https://tailwindcss.com/): For styling

- **Backend (Proxy)**:
  - [Node.js](https://nodejs.org/)
  - [Express](https://expressjs.com/)
  - [node-fetch](https://www.npmjs.com/package/node-fetch): For making API calls to Jira

---

> ### Development Note
> The code in this repository was largely generated and refactored with the assistance of a large language model from Google. The development process was iterative, evolving through a series of conversational prompts to build features, design the UI, and structure the application.

---

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (version 14.x or later)
- `npm` or `yarn` package manager

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone <your-repository-url>
    cd <your-repository-name>
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Setup Backend Proxy:**
    This project requires a simple Node.js proxy server to securely handle requests to the Jira API. The server code (`server.js`) is included.
    
    - Create a `.env` file in the root directory of the project.
    - Add the following environment variables to the `.env` file:

      ```env

      # The email address associated with your Atlassian account
      JIRA_API_USER=your-email@example.com

      # Your Jira API Token
      JIRA_API_TOKEN=your_jira_api_token_here
      ```

    - To get your `JIRA_API_TOKEN`, go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens), create a new token, and copy it immediately.

4.  **Running the Application:**
    You will need to run two processes in two separate terminal windows.

    - **Terminal 1: Start the Proxy Server**
      ```sh
      node server.js
      # The server should start on port 4000
      ```

    - **Terminal 2: Start the React App**
      ```sh
      npm start
      # The React app will start on port 3000
      ```

5.  **Open the Dashboard:**
    Open your browser and navigate to `http://localhost:3000`.

### Configuration

Once the application is running, you need to tell it which Jira project to display.

1.  Click the **Config** button in the top-right corner.
2.  In the modal that appears, enter your Jira **Project Key** (e.g., `BUSINT`, `PROJ`).
3.  (Optional) You can also filter by specific assignee emails by adding them in a comma-separated list.
4.  Click **Save & Close**. The dashboard will automatically fetch the data for your project.

## License

This project is licensed under the MIT License.