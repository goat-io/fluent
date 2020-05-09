process.env.NODE_ENV = 'test'
import mongoose from 'mongoose'
import { mongoMemory } from '../../../../core/Database/mongo.memory'
import { Form } from './tests/Forms/SingleNumerComponent'
import { textForm } from './tests/Forms/SingleTextComponent'
import { advancedNumberForm } from './tests/Forms/AdvancedRelationsTest'
import { Validate, FormioValidationError } from '../Validate'
import { For } from '../../../For'
import { IDataElement } from '../../../../BaseConnector'
import { ComplexNumberForm } from './tests/Forms/ComplexNumberComponent'
// Start the MongoDB database before
// calling all the tests
beforeAll(async () => {
  /*
  const mongo = await mongoMemory.start()
  process.env.MONGO_URL = mongo.url
  await mongoose.connect(mongo.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  */
})

test('Should validate number component', async () => {
  const wrongSubmission = { data: { number: 'HELLO WORLD' } }
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(Form, wrongSubmission)
  )

  expect(error.name).toBe('ValidationError')
  expect(error.details[0].message).toBe('"number" must be a number')

  const validSubmission = { data: { number: 3 } }
  const [error2, submission2] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(Form, validSubmission)
  )

  expect(error2).toBe(null)
  expect(submission2.number).toBe(3)
})

test('Should validate required number', async () => {
  const wrongSubmission = { data: { number: undefined } }
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(Form, wrongSubmission)
  )
  expect(error.name).toBe('ValidationError')
  expect(error.details[0].message).toBe('"number" is required')
})

test('Should validate minimum and maximum number', async () => {
  let error
  let submission
  const wrongSubmissionMIN = { data: { number: 4 } }
  ;[error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(ComplexNumberForm, wrongSubmissionMIN)
  )
  expect(error.name).toBe('ValidationError')
  expect(error.details[0].message).toBe('"number" must be larger than or equal to 10')

  const wrongSubmissionMAX = { data: { number: 100 } }
  ;[error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(ComplexNumberForm, wrongSubmissionMAX)
  )
  expect(error.name).toBe('ValidationError')
  expect(error.details[0].message).toBe('"number" must be less than or equal to 20')

  const rightSubmission = { data: { number: 15 } }
  ;[error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(ComplexNumberForm, rightSubmission)
  )
  expect(error).toBe(null)
  expect(submission.number).toBe(15)
})

test('Should validate required text', async () => {
  const wrongSubmission = { data: { text: undefined } }
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(textForm, wrongSubmission)
  )
  expect(error.name).toBe('ValidationError')
  expect(error.details[0].message).toBe('"text" is required')
})

test('Should validate text Type', async () => {
  const wrongSubmission = { data: { text: 3 } }
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(textForm, wrongSubmission)
  )
  expect(error.name).toBe('ValidationError')
  expect(error.details[0].message).toBe('"text" must be a string')
})



/*

test('Should validate text min length', async () => {
  const wrongSubmission = { data: { text: 'Hell' } }
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(textForm, wrongSubmission)
  )

  console.log(error)

  // expect(error.name).toBe('ValidationError')
  // expect(error.details[0].message).toBe('"text" length must be at least 5 characters long')
})




test("Should validate text max length", async () => {
  const wrongSubmission = { data: { text: "Hello World long text!" } };
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(textForm, wrongSubmission)
  );
  expect(error.name).toBe("ValidationError");
  expect(error.details[0].message).toBe(
    '"text" length must be less than or equal to 10 characters long'
  );
});

test("Should validate text max length on Array Submission", async () => {
  const wrongSubmission = [
    { data: { text: "Hello" } },
    { data: { text: "Hello World long text!" } }
  ];
  const [error, submission] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(textForm, wrongSubmission)
  );
  expect(error.name).toBe("ValidationError");
  expect(error.details[0].message).toBe(
    '"text" length must be less than or equal to 10 characters long'
  );
  const rightSubmission = [
    { data: { text: "Hello" } },
    { data: { text: "Hello" } }
  ];
  const [error1, submission1] = await For.async<IDataElement, FormioValidationError>(
    Validate.submission(textForm, rightSubmission)
  );
  expect(submission1[0].data.text).toBe("Hello");
});

test("Should validate Form type", async () => {
  const _Form = {
    ...Form,
    ...{
      type: "somerandom"
    }
  };
  const [error, form] = await For.async<IDataElement, FormioValidationError>(Validate.form(_Form));
  expect(typeof error).toBe("object");
  expect(error.errors.type.name).toBe("ValidatorError");
});

test("Should return the valid Form", async () => {
  const _Form = {
    ...Form
  };
  const [error, form] = await For.async<IDataElement, FormioValidationError>(Validate.form(_Form));
  expect(error).toBe(null);
  expect(typeof form).toBe("object");
  expect(form._id).toBe("5d24e91176853baf2b663a60");
});
*/
afterAll(() => {
  // mongoose.connection.close()
})
