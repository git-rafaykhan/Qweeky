import express, {Request, Response} from 'express';
import client, { connectToDb } from './migrations/db';
import { secret } from './config';
import jwt from 'jsonwebtoken';
import { authMiddleware  } from './middleware/authMiddleware';

const app = express()

app.use(express.json());
connectToDb();


const port = 8080
app.listen(port, ()=> {
    console.log(`app is listening on port ${port}`)
})


// Routes yahan sy hn 
interface userData{
    username : string; 
    email : string; 
    password: string;
}

app.post('/api/v1/signup', async (req: Request, res: Response)=> {
    
    const {username, email, password} = req.body as userData;

    if(!username || !email || !password){
        res.status(400).json({message : "All fields must be required"})
    }

    try{
        const insertQuery = `
            INSERT INTO users (username, email, password)
            VALUES ($1, $2, $3)
            RETURNING id, username, email, created_at;
            `;  
          const data = await client.query(insertQuery, [username, email, password]);
          res.status(200).json({
            message : "user has been signed up ", 
            user : data.rows
         });
       
    }catch(error: any){
        if(error.code == '23505'){
            res.status(401).json({error : "user already exist"});
        }
        res.status(500).json({error: "internal server error a gya ha bhai "})
    }
})

//@ts-ignore
app.post('/api/v1/signin', async (req: Request, res: Response)=> {
  const { email, password } = req.body;

  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User is not signed up' });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(400).json({ message: 'Incorrect credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, secret);

    res.status(200).json({ message: 'User has been logged in', token });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//! User Routes 
//@ts-ignore
app.get('/api/v1/users/:id', async (req: Request, res: Response) => {
  const userId = req.params.id;

  try {
    const result = await client.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
})

//@ts-ignore
app.get('/api/v1/users/:id/questions', async (req: Request, res: Response) => {
  const userId = req.params.id;

  try {
    const result = await client.query(
      'SELECT id, title, body, created_at FROM questions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return res.status(200).json({ questions: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
})

//! Questions Routes 

app.get('/api/v1/questions', async (req: Request, res: Response) => {
  try {
    const result = await client.query('SELECT * FROM questions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//@ts-ignore
app.get('/api/v1/questions/:id', async (req: Request, res: Response) => {
  const questionId = req.params.id;
  try {
    const question = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);
     const answers = await client.query('SELECT * FROM answers WHERE question_id = $1', [questionId]);

      if (question.rows.length === 0) {
        return res.status(404).json({ message: 'Question not found' });
      }

      res.status(200).json({
        question: question.rows[0],
        answers: answers.rows
      });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//@ts-ignore 

app.post('/api/v1/questions', authMiddleware, async (req: Request, res: Response) => {
  const { title, body } = req.body;
  //@ts-ignore
const userId = req.userId;

  try {
    const result = await client.query(
      'INSERT INTO questions (title, body, user_id) VALUES ($1, $2, $3) RETURNING *',
      [title, body, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//@ts-ignore 

app.put('/api/v1/questions/:id', authMiddleware, async (req: Request, res: Response) => {
  const { title, body } = req.body;
  const questionId = req.params.id;
  const userId = req.userId;

  try {
    const question = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);
    if (question.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }
    if (question.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updated = await client.query(
      'UPDATE questions SET title = $1, body = $2 WHERE id = $3 RETURNING *',
      [title, body, questionId]
    );
    res.status(200).json(updated.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a question (auth + ownership required)
//@ts-ignore
app.delete('/api/v1/questions/:id', authMiddleware, async (req: Request, res: Response) => {
  const questionId = req.params.id;
  const userId = req.userId;

  try {
    const question = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);
    if (question.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }
    if (question.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await client.query('DELETE FROM questions WHERE id = $1', [questionId]);
    res.status(200).json({ message: 'Question deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});


//! answers toute
//@ts-ignore
app.post('/api/v1/questions/:id/answers', authMiddleware, async (req: Request, res: Response) => {
  const questionId = req.params.id;
  const { body } = req.body;
  //@ts-ignore
  const userId = req.userId;

  if (!body) {
    return res.status(400).json({ message: 'Answer body is required' });
  }

  try {
    const question = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);
   
    if (question.rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const newAnswer = await client.query(
      'INSERT INTO answers (question_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
      [questionId, userId, body]
    );

      res.status(201).json({ message: 'Answer created', answer: newAnswer.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Editt answer
//@ts-ignore
app.put('/api/v1/answers/:id', authMiddleware, async (req: Request, res: Response) => {
  const answerId = req.params.id;
  const { body } = req.body;
  //@ts-ignore
  const userId = req.userId;

  try {
    const answer = await client.query('SELECT * FROM answers WHERE id = $1', [answerId]);

    if (answer.rows.length === 0) {
      return res.status(404).json({ message: 'Answer not found' });
    }

  
    if (answer.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updatedAnswer = await client.query(
      'UPDATE answers SET body = $1 WHERE id = $2 RETURNING *',
      [body, answerId]
    );

    res.status(200).json({ message: 'Answer updated', answer: updatedAnswer.rows[0] });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Internal server error' });
  }
});

//  Delete an answer
//@ts-ignore
app.delete('/api/v1/answers/:id', authMiddleware, async (req: Request, res: Response) => {
  const answerId = req.params.id;
  //@ts-ignore
  const userId = req.userId;

  try {
    const answer = await client.query('SELECT * FROM answers WHERE id = $1', [answerId]);
    if (answer.rows.length === 0) {
      return res.status(404).json({ message: 'Answer not found' });
    }
    if (answer.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await client.query('DELETE FROM answers WHERE id = $1', [answerId]);
    res.status(200).json({ message: 'Answer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});