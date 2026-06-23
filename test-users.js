import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('https://smart-insolvency-backend.onrender.com/api/users?adminEmail=activemind.solutions2020@gmail.com');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
