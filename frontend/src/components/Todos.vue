<template>
  <div>
    <app-nav></app-nav>
    <div class='container'>
      <spinner v-show='isProcessing' message='Processing...'></spinner>
      <div class="row">
        <div class="col-sm-12 text-left">
        <h1>
          TODOs
          <transition name="fade">
            <small v-if="total">({{ total }})</small>
          </transition>
        </h1>
        </div>
      </div>

      <div class='row'>
        <div class='col-sm-12'>
          <div class='form-control-feedback'>
            <span class='text-danger align-middle'>
            {{ errorMessage }}
            </span>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-sm-10">
          <input type="text"
                class="form-control"
                v-model="newTask"
                @keyup.enter="addTask"
                placeholder="New task"
          >
        </div>
        <div class="col-sm-2 text-right">
          <button type="submit" class="btn btn-primary" @click="addTask" >Add todo</button>
        </div>
      </div>

      <div class="row">
        <transition-group name="fade" tag="ul" class="no-bullet list-group col-sm-12 my-4">
                  <todo-item v-for="(todo, index) in tasks"
                            @remove="removeTask(index)"
                            :todo="todo"
                            :key="index"
                  ></todo-item>
        </transition-group>
      </div>

    </div>
  </div>
</template>

<script>
import AppNav from '@/components/AppNav'
import TodoItem from '@/components/TodoItem'
import Spinner from '@/components/common/Spinner'

const TODOS_API_BASE_URL = 'https://todos-api-production-30d6.up.railway.app';

export default {
  name: 'todos',
  components: {AppNav, TodoItem, Spinner},
  props: {
    tasks: {
      default: function () {
        return []
      }
    }
  },
  data () {
    return {
      isProcessing: false,
      errorMessage: '',
      newTask: ''
    }
  },
  created () {
    this.loadTasks()
  },
  computed: {
    total () {
      return this.tasks.length
    }
  },
  methods: {
    loadTasks () {
      this.isProcessing = true
      this.errorMessage = ''
      this.$http.get('${TODOS_API_BASE_URL}/todos'.then(response => {
        this.tasks.splice(0, this.tasks.length);
        for (var i in response.body) {
          this.tasks.push(response.body[i])
        }
        this.isProcessing = false
      }, error => {
        this.isProcessing = false
        this.errorMessage = `Error loading tasks: ${error.status} - ${JSON.stringify(error.body)}`; // Mensaje de error más claro      })
      },

    addTask () {
      if (this.newTask) {
        this.isProcessing = true
        this.errorMessage = ''

        var task = {
          content: this.newTask
        }

        this.$http.post(`${TODOS_API_BASE_URL}/todos`, task).then(response => {
          this.newTask = ''
          this.isProcessing = false
          if (response.body && response.body.id) {
             this.tasks.push(response.body);
          } else {
             // Fallback si la API no devuelve el objeto completo (menos ideal)
             // Necesitarías volver a cargar todo o manejarlo de otra forma.
             console.warn("API did not return created task with ID. Pushing local task object.");
             // this.tasks.push(task); // Esto no tendrá el ID correcto de la base de datos
             this.loadTasks(); // O simplemente recarga todo
          }
        }, error => {
          this.isProcessing = false
          this.errorMessage = `Error adding task: ${error.status} - ${JSON.stringify(error.body)}`;        })
      }
    },

    removeTask (index) {
      const item = this.tasks[index]
      // Asegúrate de que 'item' y 'item.id' existan antes de proceder
      if (!item || typeof item.id === 'undefined') {
         console.error("Cannot remove task: item or item.id is undefined", item);
         this.errorMessage = "Cannot remove task: Invalid item data.";
         return;
      }

      this.isProcessing = true
      this.errorMessage = ''

      // --- MODIFICADO: Usa la URL absoluta ---
      this.$http.delete(`${TODOS_API_BASE_URL}/todos/${item.id}`).then(response => {
        this.isProcessing = false
        this.tasks.splice(index, 1)
      }, error => {
        this.isProcessing = false
        this.errorMessage = `Error deleting task: ${error.status} - ${JSON.stringify(error.body)}`;
      })
    }
  }
}
</script>